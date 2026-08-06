const fs = require('node:fs/promises');
const {
	serializeJson,
	writeJsonAtomically,
	writeSerializedJsonAtomically,
} = require('./atomicJsonFile');
const { runEntityOperation } = require('./entityOperationQueue');
const { assertEntityKeyAvailable } = require('./entityKeyRegistry');
const {
	commitHistoryThenMutation,
	commitMutationThenHistory,
	commitPermanentDeletion,
} = require('./entityPersistenceTransaction');

function createConcreteEntityStore({
	createEntityInstance,
	createHistoryLoadError,
	createLoadError,
	createEditorError,
	createOwnerError,
	entityProperty,
	entityType,
	getSavePath,
	history,
	hydrate,
	prepareCreatedEntity = () => undefined,
	reportHistoryLoadError = console.error,
	reportLoadError = console.error,
	saveDirectory,
	validateKey,
	validateSave,
}) {
	async function create(entityKey, creatorId, initialize = () => undefined) {
		validateKey(entityKey);
		return runEntityOperation(entityKey, async () => {
			await assertEntityKeyAvailable(entityKey);
			const entity = createEntityInstance(entityKey, creatorId);
			await initialize(entity);
			prepareCreatedEntity(entity, entityKey);
			validateSave(entity, entityKey);
			await writeJsonAtomically(getSavePath(entityKey), entity, { exclusive: true });
			return entity;
		});
	}

	async function deleteEntity(entityKey, canManage) {
		return runEntityOperation(entityKey, async () => {
			const current = await readRecord(entityKey);
			if (!canManage(current.entity)) {
				throw createOwnerError();
			}

			const historyState = await history.readFileState(entityKey);
			await commitPermanentDeletion({
				deleteEntity: () => fs.unlink(getSavePath(entityKey)),
				deleteHistory: () => history.delete(historyState),
				entityKey,
				entityType,
				restoreHistory: () => history.restore(historyState),
			});
		});
	}

	async function update(entityKey, canManage, mutation, historyContext = null) {
		return runEntityOperation(entityKey, async () => {
			const current = await readRecord(entityKey);
			const { entity } = current;
			if (!canManage(entity)) {
				throw createEditorError();
			}

			await mutation(entity);
			validateSave(entity, entityKey);
			const serializedEntity = serializeJson(entity);
			if (!historyContext) {
				await writeSerializedJsonAtomically(
					getSavePath(entityKey),
					serializedEntity,
				);
				return entity;
			}

			const historyState = await history.read(entityKey);
			const nextHistory = history.push(
				historyState,
				current.rawSaveData,
				historyContext,
			);
			const serializedHistory = serializeJson(nextHistory.document);
			await commitHistoryThenMutation({
				commitMutation: () => writeSerializedJsonAtomically(
					getSavePath(entityKey),
					serializedEntity,
				),
				entityKey,
				entityType,
				rollbackHistory: () => history.restore(historyState),
				writeHistory: () => history.writePrepared(
					historyState.path,
					serializedHistory,
				),
			});
			return entity;
		});
	}

	async function get(entityKey) {
		return (await readRecord(entityKey)).entity;
	}

	async function list({ onLoadError = reportLoadError } = {}) {
		await fs.mkdir(saveDirectory, { recursive: true });
		const entries = await fs.readdir(saveDirectory, { withFileTypes: true });
		const entities = await Promise.all(entries
			.filter(entry => entry.isFile() && entry.name.endsWith('.json'))
			.map(async entry => {
				const entityKey = entry.name.slice(0, -'.json'.length);
				try {
					return await get(entityKey);
				}
				catch (error) {
					onLoadError(createLoadError(entityKey, error));
					return null;
				}
			}));
		return sortEntities(entities.filter(Boolean));
	}

	async function listUndoable(
		canManage,
		{ onLoadError = reportHistoryLoadError } = {},
	) {
		const entityKeys = await history.listKeys();
		const entities = await Promise.all(entityKeys.map(entityKey => (
			runEntityOperation(entityKey, async () => {
				try {
					const historyState = await history.read(entityKey);
					const historyEntity = history.getUsableEntity(
						historyState,
						entityKey,
					);
					if (!historyEntity) {
						return null;
					}

					const current = await readOptionalRecord(entityKey);
					const authorizationEntity = current?.entity ?? historyEntity;
					return canManage(authorizationEntity)
						? authorizationEntity
						: null;
				}
				catch (error) {
					onLoadError(createHistoryLoadError(entityKey, error));
					return null;
				}
			})
		)));
		return sortEntities(entities.filter(Boolean));
	}

	async function undo(entityKey, canManage, { maxEntries }) {
		return runEntityOperation(entityKey, async () => {
			const current = await readOptionalRecord(entityKey);
			if (current && !canManage(current.entity)) {
				throw createEditorError();
			}

			const historyState = await history.read(entityKey);
			const undoResult = history.pop(historyState, maxEntries, entityKey);
			const entity = undoResult[entityProperty];
			if (!current && !canManage(entity)) {
				throw createEditorError();
			}

			validateSave(entity, entityKey);
			const serializedEntity = serializeJson(entity);
			const serializedHistory = serializeJson(undoResult.document);
			await commitMutationThenHistory({
				commitMutation: () => writeSerializedJsonAtomically(
					getSavePath(entityKey),
					serializedEntity,
				),
				entityKey,
				entityType,
				rollbackMutation: () => restoreRecord(entityKey, current),
				writeHistory: () => history.writePrepared(
					historyState.path,
					serializedHistory,
				),
			});
			return {
				entity,
				action: undoResult.entry.action,
				actorId: undoResult.entry.actorId,
				createdAt: undoResult.entry.createdAt,
			};
		});
	}

	async function readRecord(entityKey) {
		const serialized = await fs.readFile(getSavePath(entityKey), 'utf8');
		const rawSaveData = JSON.parse(serialized);
		validateSave(rawSaveData, entityKey);
		return {
			entity: hydrate(rawSaveData, entityKey),
			rawSaveData,
			serialized,
		};
	}

	async function readOptionalRecord(entityKey) {
		try {
			return await readRecord(entityKey);
		}
		catch (error) {
			if (error.code === 'ENOENT') {
				return null;
			}
			throw error;
		}
	}

	async function restoreRecord(entityKey, record) {
		const savePath = getSavePath(entityKey);
		if (record) {
			await writeSerializedJsonAtomically(savePath, record.serialized);
			return;
		}
		await unlinkIfPresent(savePath);
	}

	return { create, delete: deleteEntity, get, list, listUndoable, undo, update };
}

function sortEntities(entities) {
	return entities.sort((left, right) => left.key.localeCompare(right.key));
}

async function unlinkIfPresent(filePath) {
	try {
		await fs.unlink(filePath);
	}
	catch (error) {
		if (error.code !== 'ENOENT') {
			throw error;
		}
	}
}

module.exports = { createConcreteEntityStore };

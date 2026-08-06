const fs = require('node:fs/promises');
const Creature = require('../models/Creature');
const {
	serializeJson,
	writeJsonAtomically,
	writeSerializedJsonAtomically,
} = require('./atomicJsonFile');
const {
	deleteCreatureHistory,
	getUsableHistoryCreature,
	listCreatureHistoryKeys,
	popCreatureHistory,
	pushCreatureHistory,
	readCreatureHistory,
	readCreatureHistoryFileState,
	restoreCreatureHistory,
	writePreparedCreatureHistory,
} = require('./creatureHistoryStore');
const { runEntityOperation } = require('./characterOperationQueue');
const { assertEntityKeyAvailable } = require('./entityKeyRegistry');
const {
	commitHistoryThenMutation,
	commitMutationThenHistory,
	commitPermanentDeletion,
} = require('./characterPersistenceTransaction');
const { validateCreatureSaveSchema } = require('./creatureSaveSchema');
const {
	creatureSaveDirectory,
	getCreatureSavePath,
	validateEntityKey,
} = require('./characterStoragePaths');

async function createCreature(entityKey, creatorId, initialize = () => undefined) {
	validateEntityKey(entityKey);
	return runEntityOperation(entityKey, async () => {
		await assertEntityKeyAvailable(entityKey);
		const creature = new Creature(entityKey, creatorId);
		await initialize(creature);
		validateCreatureSaveSchema(creature, entityKey);
		await writeJsonAtomically(
			getCreatureSavePath(entityKey),
			creature,
			{ exclusive: true },
		);
		return creature;
	});
}

async function deleteCreature(entityKey, canManage) {
	return runEntityOperation(entityKey, async () => {
		const current = await readCreatureRecord(entityKey);
		if (!canManage(current.creature)) {
			throw creatureOwnerError();
		}

		const historyState = await readCreatureHistoryFileState(entityKey);
		await commitPermanentDeletion({
			deleteEntity: () => fs.unlink(getCreatureSavePath(entityKey)),
			deleteHistory: () => deleteCreatureHistory(historyState),
			entityKey,
			entityType: 'creature',
			restoreHistory: () => restoreCreatureHistory(historyState),
		});
	});
}

async function updateCreature(
	entityKey,
	canManage,
	update,
	historyContext = null,
) {
	return runEntityOperation(entityKey, async () => {
		const current = await readCreatureRecord(entityKey);
		const { creature } = current;
		if (!canManage(creature)) {
			throw creatureEditorError();
		}

		await update(creature);
		validateCreatureSaveSchema(creature, entityKey);
		const serializedCreature = serializeJson(creature);
		if (!historyContext) {
			await writeSerializedJsonAtomically(
				getCreatureSavePath(entityKey),
				serializedCreature,
			);
			return creature;
		}

		const historyState = await readCreatureHistory(entityKey);
		const nextHistory = pushCreatureHistory(
			historyState,
			current.rawSaveData,
			historyContext,
		);
		const serializedHistory = serializeJson(nextHistory.document);
		await commitHistoryThenMutation({
			commitMutation: () => writeSerializedJsonAtomically(
				getCreatureSavePath(entityKey),
				serializedCreature,
			),
			entityKey,
			entityType: 'creature',
			rollbackHistory: () => restoreCreatureHistory(historyState),
			writeHistory: () => writePreparedCreatureHistory(
				historyState.path,
				serializedHistory,
			),
		});
		return creature;
	});
}

async function getCreature(entityKey) {
	return (await readCreatureRecord(entityKey)).creature;
}

async function listCreatures({ onLoadError = reportCreatureLoadError } = {}) {
	await fs.mkdir(creatureSaveDirectory, { recursive: true });
	const entries = await fs.readdir(creatureSaveDirectory, { withFileTypes: true });
	const creatures = await Promise.all(entries
		.filter(entry => entry.isFile() && entry.name.endsWith('.json'))
		.map(async entry => {
			const key = entry.name.slice(0, -'.json'.length);
			try {
				return await getCreature(key);
			}
			catch (error) {
				onLoadError(new CreatureLoadError(key, error));
				return null;
			}
		}));
	return creatures
		.filter(Boolean)
		.sort((left, right) => left.key.localeCompare(right.key));
}

async function listUndoableCreatures(
	canManage,
	{ onLoadError = reportCreatureHistoryLoadError } = {},
) {
	const entityKeys = await listCreatureHistoryKeys();
	const creatures = await Promise.all(entityKeys.map(entityKey => (
		runEntityOperation(entityKey, async () => {
			try {
				const historyState = await readCreatureHistory(entityKey);
				const historyCreature = getUsableHistoryCreature(
					historyState,
					entityKey,
				);
				if (!historyCreature) {
					return null;
				}

				let activeCreature;
				try {
					activeCreature = await getCreature(entityKey);
				}
				catch (error) {
					if (error.code !== 'ENOENT') {
						throw error;
					}
					activeCreature = null;
				}
				const authorizationCreature = activeCreature ?? historyCreature;
				return canManage(authorizationCreature)
					? authorizationCreature
					: null;
			}
			catch (error) {
				onLoadError(new CreatureHistoryLoadError(entityKey, error));
				return null;
			}
		})
	)));
	return creatures
		.filter(Boolean)
		.sort((left, right) => left.key.localeCompare(right.key));
}

async function undoCreature(entityKey, canManage, { maxEntries }) {
	return runEntityOperation(entityKey, async () => {
		let current = null;
		try {
			current = await readCreatureRecord(entityKey);
		}
		catch (error) {
			if (error.code !== 'ENOENT') {
				throw error;
			}
		}

		if (current && !canManage(current.creature)) {
			throw creatureEditorError();
		}

		const historyState = await readCreatureHistory(entityKey);
		const undo = popCreatureHistory(historyState, maxEntries, entityKey);
		if (!current && !canManage(undo.creature)) {
			throw creatureEditorError();
		}

		validateCreatureSaveSchema(undo.creature, entityKey);
		const serializedCreature = serializeJson(undo.creature);
		const serializedHistory = serializeJson(undo.document);
		await commitMutationThenHistory({
			commitMutation: () => writeSerializedJsonAtomically(
				getCreatureSavePath(entityKey),
				serializedCreature,
			),
			entityKey,
			entityType: 'creature',
			rollbackMutation: () => restoreCreatureRecord(entityKey, current),
			writeHistory: () => writePreparedCreatureHistory(
				historyState.path,
				serializedHistory,
			),
		});
		return {
			action: undo.entry.action,
			actorId: undo.entry.actorId,
			creature: undo.creature,
			createdAt: undo.entry.createdAt,
		};
	});
}

class CreatureLoadError extends Error {
	constructor(entityKey, cause) {
		super(`Could not load creature save "${entityKey}": ${cause.message}`, { cause });
		this.name = 'CreatureLoadError';
		this.code = 'INVALID_CREATURE_SAVE';
		this.entityKey = entityKey;
	}
}

class CreatureHistoryLoadError extends Error {
	constructor(entityKey, cause) {
		super(`Could not load creature history "${entityKey}": ${cause.message}`, {
			cause,
		});
		this.name = 'CreatureHistoryLoadError';
		this.code = 'INVALID_CREATURE_HISTORY';
		this.entityKey = entityKey;
	}
}

async function readCreatureRecord(entityKey) {
	const serialized = await fs.readFile(getCreatureSavePath(entityKey), 'utf8');
	const rawSaveData = JSON.parse(serialized);
	validateCreatureSaveSchema(rawSaveData, entityKey);
	return {
		creature: Creature.fromSave(rawSaveData, entityKey),
		rawSaveData,
		serialized,
	};
}

async function restoreCreatureRecord(entityKey, record) {
	const savePath = getCreatureSavePath(entityKey);
	if (record) {
		await writeSerializedJsonAtomically(savePath, record.serialized);
		return;
	}
	try {
		await fs.unlink(savePath);
	}
	catch (error) {
		if (error.code !== 'ENOENT') {
			throw error;
		}
	}
}

function reportCreatureLoadError(error) {
	console.error(error);
}

function reportCreatureHistoryLoadError(error) {
	console.error(error);
}

function creatureEditorError() {
	const error = new Error('Only the creature creator or a DM can edit it.');
	error.code = 'NOT_CREATURE_EDITOR';
	return error;
}

function creatureOwnerError() {
	const error = new Error('Only the creature creator or a DM can delete it.');
	error.code = 'NOT_CREATURE_OWNER';
	return error;
}

module.exports = {
	CreatureHistoryLoadError,
	CreatureLoadError,
	createCreature,
	deleteCreature,
	getCreature,
	listCreatures,
	listUndoableCreatures,
	undoCreature,
	updateCreature,
};

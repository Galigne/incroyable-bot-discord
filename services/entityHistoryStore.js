const fs = require('node:fs/promises');
const { writeSerializedJsonAtomically } = require('./atomicJsonFile');

function createEntityHistoryStore({
	actions,
	createDocument,
	createHistoryError,
	entityLabel,
	entityProperty,
	getHistoryPath,
	historyDirectory,
	hydrateSnapshot,
	storedActions = actions,
	validateDocumentEnvelope,
	validateKey,
	validateSnapshot,
}) {
	async function readHistory(entityKey) {
		const historyState = await readHistoryFileState(entityKey);
		if (!historyState.exists) {
			return { ...historyState, document: createDocument([]) };
		}

		try {
			const document = JSON.parse(historyState.serialized);
			validateHistoryDocument(document);
			return { ...historyState, document };
		}
		catch (error) {
			throw createHistoryError(
				`INVALID_${entityLabel.toUpperCase()}_HISTORY`,
				`${capitalize(entityLabel)} history data is invalid.`,
				error,
			);
		}
	}

	async function readHistoryFileState(entityKey) {
		const historyPath = getHistoryPath(entityKey);
		try {
			return {
				exists: true,
				path: historyPath,
				serialized: await fs.readFile(historyPath, 'utf8'),
			};
		}
		catch (error) {
			if (error.code === 'ENOENT') {
				return { exists: false, path: historyPath, serialized: null };
			}
			throw error;
		}
	}

	async function deleteHistory(historyState) {
		if (!historyState.exists) {
			return;
		}
		await unlinkIfPresent(historyState.path);
	}

	async function listHistoryKeys() {
		try {
			const entries = await fs.readdir(historyDirectory, { withFileTypes: true });
			return entries
				.filter(entry => entry.isFile() && entry.name.endsWith('.json'))
				.map(entry => entry.name.slice(0, -'.json'.length))
				.filter(entityKey => isValidKey(entityKey, validateKey))
				.sort((left, right) => left.localeCompare(right));
		}
		catch (error) {
			if (error.code === 'ENOENT') {
				return [];
			}
			throw error;
		}
	}

	function pushHistory(historyState, snapshot, context) {
		validateHistoryContext(context);
		validateSnapshotForBackup(snapshot);
		const entry = {
			createdAt: context.createdAt ?? new Date().toISOString(),
			actorId: context.actorId,
			action: context.action,
			[entityProperty]: structuredClone(snapshot),
		};
		validateHistoryEntry(entry);
		const entries = [...historyState.document.entries, entry]
			.slice(-context.maxEntries);
		return { document: createDocument(entries), entry };
	}

	function popHistory(historyState, maxEntries, entityKey) {
		validateMaxEntries(maxEntries);
		const boundedEntries = historyState.document.entries.slice(-maxEntries);
		if (boundedEntries.length === 0) {
			throw createHistoryError(
				`NO_${entityLabel.toUpperCase()}_HISTORY`,
				`No ${entityLabel} history entry is available.`,
			);
		}
		const entry = boundedEntries.at(-1);
		return {
			[entityProperty]: restoreHistoryEntry(entry, entityKey),
			document: createDocument(boundedEntries.slice(0, -1)),
			entry,
		};
	}

	function getUsableHistoryEntity(historyState, entityKey) {
		const entry = historyState.document.entries.at(-1);
		return entry ? restoreHistoryEntry(entry, entityKey) : null;
	}

	async function writePreparedHistory(historyPath, serializedDocument) {
		await writeSerializedJsonAtomically(historyPath, serializedDocument);
	}

	async function restoreHistory(historyState) {
		if (historyState.exists) {
			await writeSerializedJsonAtomically(
				historyState.path,
				historyState.serialized,
			);
			return;
		}
		await unlinkIfPresent(historyState.path);
	}

	function validateHistoryDocument(document) {
		validateDocumentEnvelope(document);
		for (const entry of document.entries) {
			validateHistoryEntry(entry);
		}
	}

	function validateHistoryEntry(entry) {
		if (
			!entry
			|| typeof entry !== 'object'
			|| Array.isArray(entry)
			|| typeof entry.createdAt !== 'string'
			|| !isIsoTimestamp(entry.createdAt)
			|| typeof entry.actorId !== 'string'
			|| entry.actorId.trim() === ''
			|| !storedActions.has(entry.action)
			|| !entry[entityProperty]
			|| typeof entry[entityProperty] !== 'object'
			|| Array.isArray(entry[entityProperty])
		) {
			throw new TypeError(
				`${capitalize(entityLabel)} history entry metadata is invalid.`,
			);
		}
	}

	function validateHistoryContext(context) {
		if (!context || typeof context !== 'object' || Array.isArray(context)) {
			throw new TypeError(
				`${capitalize(entityLabel)} history operation context is required.`,
			);
		}
		if (typeof context.actorId !== 'string' || context.actorId.trim() === '') {
			throw new TypeError(
				`${capitalize(entityLabel)} history actorId is required.`,
			);
		}
		if (!actions.has(context.action)) {
			throw new TypeError(
				`Unsupported ${entityLabel} history action: ${context.action}.`,
			);
		}
		validateMaxEntries(context.maxEntries);
	}

	function validateMaxEntries(maxEntries) {
		if (!Number.isInteger(maxEntries) || maxEntries <= 0) {
			throw new TypeError(
				`${capitalize(entityLabel)} history maxEntries must be a positive integer.`,
			);
		}

	}

	function validateSnapshotForBackup(snapshot) {
		try {
			validateSnapshot(snapshot, snapshot.key);
		}
		catch (error) {
			throw createHistoryError(
				`INVALID_${entityLabel.toUpperCase()}_HISTORY_SNAPSHOT`,
				`${capitalize(entityLabel)} snapshot cannot be added to history.`,
				error,
			);
		}
	}

	function restoreHistoryEntry(entry, entityKey) {
		try {
			validateHistoryEntry(entry);
			const snapshot = entry[entityProperty];
			validateSnapshot(snapshot, entityKey);
			return hydrateSnapshot(structuredClone(snapshot), entityKey);
		}
		catch (error) {
			const unsupported = error.code
				=== `UNSUPPORTED_${entityLabel.toUpperCase()}_SCHEMA_VERSION`;
			throw createHistoryError(
				unsupported
					? `UNSUPPORTED_${entityLabel.toUpperCase()}_HISTORY_SCHEMA`
					: `INVALID_${entityLabel.toUpperCase()}_HISTORY_SNAPSHOT`,
				unsupported
					? `${capitalize(entityLabel)} history uses an unsupported save schema.`
					: `${capitalize(entityLabel)} history snapshot is invalid.`,
				error,
			);
		}
	}

	return {
		deleteHistory,
		getUsableHistoryEntity,
		listHistoryKeys,
		popHistory,
		pushHistory,
		readHistory,
		readHistoryFileState,
		restoreHistory,
		writePreparedHistory,
	};
}

function isIsoTimestamp(value) {
	const timestamp = Date.parse(value);
	return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function isValidKey(entityKey, validateKey) {
	try {
		validateKey(entityKey);
		return true;
	}
	catch {
		return false;
	}
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

function capitalize(value) {
	return value[0].toUpperCase() + value.slice(1);
}

module.exports = { createEntityHistoryStore };

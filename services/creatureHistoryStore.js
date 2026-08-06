const fs = require('node:fs/promises');
const Creature = require('../models/Creature');
const {
	writeSerializedJsonAtomically,
} = require('./atomicJsonFile');
const { validateCreatureSaveSchema } = require('./creatureSaveSchema');
const {
	creatureHistoryDirectory,
	getCreatureHistoryPath,
	validateEntityKey,
} = require('./characterStoragePaths');

const CREATURE_HISTORY_ACTIONS = new Set([
	'set',
	'damage',
	'heal',
	'end-turn',
]);

async function readCreatureHistory(entityKey) {
	const historyState = await readCreatureHistoryFileState(entityKey);
	if (!historyState.exists) {
		return {
			...historyState,
			document: createDocument([]),
		};
	}

	try {
		const document = JSON.parse(historyState.serialized);
		validateHistoryDocument(document);
		return { ...historyState, document };
	}
	catch (error) {
		throw createHistoryError(
			'INVALID_CREATURE_HISTORY',
			'Creature history data is invalid.',
			error,
		);
	}
}

async function readCreatureHistoryFileState(entityKey) {
	const historyPath = getCreatureHistoryPath(entityKey);
	try {
		return {
			exists: true,
			path: historyPath,
			serialized: await fs.readFile(historyPath, 'utf8'),
		};
	}
	catch (error) {
		if (error.code === 'ENOENT') {
			return {
				exists: false,
				path: historyPath,
				serialized: null,
			};
		}
		throw error;
	}
}

async function deleteCreatureHistory(historyState) {
	if (!historyState.exists) {
		return;
	}
	try {
		await fs.unlink(historyState.path);
	}
	catch (error) {
		if (error.code !== 'ENOENT') {
			throw error;
		}
	}
}

async function listCreatureHistoryKeys() {
	try {
		const entries = await fs.readdir(creatureHistoryDirectory, {
			withFileTypes: true,
		});
		return entries
			.filter(entry => entry.isFile() && entry.name.endsWith('.json'))
			.map(entry => entry.name.slice(0, -'.json'.length))
			.filter(entityKey => {
				try {
					validateEntityKey(entityKey);
					return true;
				}
				catch {
					return false;
				}
			})
			.sort((left, right) => left.localeCompare(right));
	}
	catch (error) {
		if (error.code === 'ENOENT') {
			return [];
		}
		throw error;
	}
}

function pushCreatureHistory(historyState, creatureSnapshot, context) {
	validateHistoryContext(context);
	validateSnapshotForBackup(creatureSnapshot);
	const entry = {
		createdAt: context.createdAt ?? new Date().toISOString(),
		actorId: context.actorId,
		action: context.action,
		creature: structuredClone(creatureSnapshot),
	};
	validateHistoryEntry(entry);
	const entries = [
		...historyState.document.entries,
		entry,
	].slice(-context.maxEntries);
	return {
		document: createDocument(entries),
		entry,
	};
}

function popCreatureHistory(historyState, maxEntries, entityKey) {
	validateMaxEntries(maxEntries);
	const boundedEntries = historyState.document.entries.slice(-maxEntries);
	if (boundedEntries.length === 0) {
		throw createHistoryError(
			'NO_CREATURE_HISTORY',
			'No creature history entry is available.',
		);
	}
	const entry = boundedEntries.at(-1);
	return {
		creature: restoreHistoryEntry(entry, entityKey),
		document: createDocument(boundedEntries.slice(0, -1)),
		entry,
	};
}

function getUsableHistoryCreature(historyState, entityKey) {
	const entry = historyState.document.entries.at(-1);
	return entry ? restoreHistoryEntry(entry, entityKey) : null;
}

async function writePreparedCreatureHistory(historyPath, serializedDocument) {
	await writeSerializedJsonAtomically(historyPath, serializedDocument);
}

async function restoreCreatureHistory(historyState) {
	if (historyState.exists) {
		await writeSerializedJsonAtomically(
			historyState.path,
			historyState.serialized,
		);
		return;
	}
	try {
		await fs.unlink(historyState.path);
	}
	catch (error) {
		if (error.code !== 'ENOENT') {
			throw error;
		}
	}
}

function createDocument(entries) {
	return {
		schemaVersion: 1,
		type: 'creature',
		entries,
	};
}

function validateHistoryDocument(document) {
	if (
		!document
		|| typeof document !== 'object'
		|| Array.isArray(document)
		|| document.schemaVersion !== 1
		|| document.type !== 'creature'
		|| !Array.isArray(document.entries)
	) {
		throw new TypeError('Creature history envelope is invalid.');
	}
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
		|| !entry.actorId.trim()
		|| !CREATURE_HISTORY_ACTIONS.has(entry.action)
		|| !entry.creature
		|| typeof entry.creature !== 'object'
		|| Array.isArray(entry.creature)
	) {
		throw new TypeError('Creature history entry metadata is invalid.');
	}
}

function isIsoTimestamp(value) {
	const timestamp = Date.parse(value);
	return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function validateHistoryContext(context) {
	if (!context || typeof context !== 'object' || Array.isArray(context)) {
		throw new TypeError('Creature history operation context is required.');
	}
	if (typeof context.actorId !== 'string' || !context.actorId.trim()) {
		throw new TypeError('Creature history actorId is required.');
	}
	if (!CREATURE_HISTORY_ACTIONS.has(context.action)) {
		throw new TypeError(`Unsupported creature history action: ${context.action}.`);
	}
	validateMaxEntries(context.maxEntries);
}

function validateMaxEntries(maxEntries) {
	if (!Number.isInteger(maxEntries) || maxEntries <= 0) {
		throw new TypeError('Creature history maxEntries must be a positive integer.');
	}
}

function validateSnapshotForBackup(snapshot) {
	try {
		validateCreatureSaveSchema(snapshot, snapshot.key);
	}
	catch (error) {
		throw createHistoryError(
			'INVALID_CREATURE_HISTORY_SNAPSHOT',
			'Creature snapshot cannot be added to history.',
			error,
		);
	}
}

function restoreHistoryEntry(entry, entityKey) {
	try {
		validateHistoryEntry(entry);
		validateCreatureSaveSchema(entry.creature, entityKey);
		return Creature.fromSave(structuredClone(entry.creature), entityKey);
	}
	catch (error) {
		const unsupported = error.code === 'UNSUPPORTED_CREATURE_SCHEMA_VERSION';
		throw createHistoryError(
			unsupported
				? 'UNSUPPORTED_CREATURE_HISTORY_SCHEMA'
				: 'INVALID_CREATURE_HISTORY_SNAPSHOT',
			unsupported
				? 'Creature history uses an unsupported save schema.'
				: 'Creature history snapshot is invalid.',
			error,
		);
	}
}

function createHistoryError(code, message, cause) {
	const error = new Error(message, cause ? { cause } : undefined);
	error.name = 'CreatureHistoryError';
	error.code = code;
	return error;
}

module.exports = {
	CREATURE_HISTORY_ACTIONS,
	deleteCreatureHistory,
	getUsableHistoryCreature,
	listCreatureHistoryKeys,
	popCreatureHistory,
	pushCreatureHistory,
	readCreatureHistory,
	readCreatureHistoryFileState,
	restoreCreatureHistory,
	writePreparedCreatureHistory,
};

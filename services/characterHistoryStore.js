const fs = require('node:fs/promises');
const Character = require('../models/Character');
const {
	serializeJson,
	writeSerializedJsonAtomically,
} = require('./atomicJsonFile');
const { validateCharacterSaveSchema } = require('./characterSaveSchema');
const {
	characterHistoryDirectory,
	getCharacterHistoryPath,
	validateCharacterKey,
} = require('./characterStoragePaths');

const CHARACTER_HISTORY_ACTIONS = new Set([
	'set',
	'damage',
	'heal',
	'end-turn',
	'delete',
]);

async function readCharacterHistory(characterKey) {
	const historyPath = getCharacterHistoryPath(characterKey);
	let serialized;
	try {
		serialized = await fs.readFile(historyPath, 'utf8');
	}
	catch (error) {
		if (error.code === 'ENOENT') {
			return {
				document: { entries: [] },
				exists: false,
				path: historyPath,
				serialized: null,
			};
		}
		throw error;
	}

	let document;
	try {
		document = JSON.parse(serialized);
		validateHistoryDocument(document);
	}
	catch (error) {
		throw createHistoryError(
			'INVALID_CHARACTER_HISTORY',
			'Character history data is invalid.',
			error,
		);
	}
	return {
		document,
		exists: true,
		path: historyPath,
		serialized,
	};
}

async function listCharacterHistoryKeys() {
	try {
		const entries = await fs.readdir(characterHistoryDirectory, {
			withFileTypes: true,
		});
		return entries
			.filter(entry => entry.isFile() && entry.name.endsWith('.json'))
			.map(entry => entry.name.slice(0, -'.json'.length))
			.filter(characterKey => {
				try {
					validateCharacterKey(characterKey);
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

function pushCharacterHistory(historyState, characterSnapshot, context) {
	validateHistoryContext(context);
	validateSnapshotForBackup(characterSnapshot);
	const entry = {
		createdAt: context.createdAt ?? new Date().toISOString(),
		actorId: context.actorId,
		action: context.action,
		character: structuredClone(characterSnapshot),
	};
	validateHistoryEntry(entry);
	const entries = [
		...historyState.document.entries,
		entry,
	].slice(-context.maxEntries);
	return {
		document: { entries },
		entry,
	};
}

function popCharacterHistory(historyState, maxEntries, characterKey) {
	validateMaxEntries(maxEntries);
	const boundedEntries = historyState.document.entries.slice(-maxEntries);
	if (boundedEntries.length === 0) {
		throw createHistoryError(
			'NO_CHARACTER_HISTORY',
			'No character history entry is available.',
		);
	}
	const entry = boundedEntries.at(-1);
	const character = restoreHistoryEntry(entry, characterKey);
	return {
		character,
		document: { entries: boundedEntries.slice(0, -1) },
		entry,
	};
}

function getUsableHistoryCharacter(historyState, characterKey) {
	const entry = historyState.document.entries.at(-1);
	if (!entry) {
		return null;
	}
	return restoreHistoryEntry(entry, characterKey);
}

async function writeCharacterHistory(historyPath, document) {
	await writeSerializedJsonAtomically(historyPath, serializeJson(document));
}

async function writePreparedCharacterHistory(historyPath, serializedDocument) {
	await writeSerializedJsonAtomically(historyPath, serializedDocument);
}

async function restoreCharacterHistory(historyState) {
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

function validateHistoryDocument(document) {
	if (
		!document
		|| typeof document !== 'object'
		|| Array.isArray(document)
		|| !Array.isArray(document.entries)
	) {
		throw new TypeError('Character history must contain an entries array.');
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
		|| entry.actorId.trim() === ''
		|| !CHARACTER_HISTORY_ACTIONS.has(entry.action)
		|| !entry.character
		|| typeof entry.character !== 'object'
		|| Array.isArray(entry.character)
	) {
		throw new TypeError('Character history entry metadata is invalid.');
	}
}

function isIsoTimestamp(value) {
	const timestamp = Date.parse(value);
	return (
		Number.isFinite(timestamp)
		&& new Date(timestamp).toISOString() === value
	);
}

function validateHistoryContext(context) {
	if (!context || typeof context !== 'object' || Array.isArray(context)) {
		throw new TypeError('Character history operation context is required.');
	}
	if (typeof context.actorId !== 'string' || context.actorId.trim() === '') {
		throw new TypeError('Character history actorId is required.');
	}
	if (!CHARACTER_HISTORY_ACTIONS.has(context.action)) {
		throw new TypeError(`Unsupported character history action: ${context.action}.`);
	}
	validateMaxEntries(context.maxEntries);
}

function validateMaxEntries(maxEntries) {
	if (!Number.isInteger(maxEntries) || maxEntries <= 0) {
		throw new TypeError('Character history maxEntries must be a positive integer.');
	}
}

function validateSnapshotForBackup(characterSnapshot) {
	try {
		validateCharacterSaveSchema(characterSnapshot);
	}
	catch (error) {
		throw createHistoryError(
			'INVALID_CHARACTER_HISTORY_SNAPSHOT',
			'Character snapshot cannot be added to history.',
			error,
		);
	}
}

function restoreHistoryEntry(entry, characterKey) {
	try {
		validateHistoryEntry(entry);
		validateCharacterSaveSchema(entry.character);
		return Character.fromSave(structuredClone(entry.character), characterKey);
	}
	catch (error) {
		const unsupported = error.code === 'UNSUPPORTED_CHARACTER_SCHEMA_VERSION';
		throw createHistoryError(
			unsupported
				? 'UNSUPPORTED_CHARACTER_HISTORY_SCHEMA'
				: 'INVALID_CHARACTER_HISTORY_SNAPSHOT',
			unsupported
				? 'Character history uses an unsupported save schema.'
				: 'Character history snapshot is invalid.',
			error,
		);
	}
}

function createHistoryError(code, message, cause) {
	const error = new Error(message, cause ? { cause } : undefined);
	error.name = 'CharacterHistoryError';
	error.code = code;
	return error;
}

module.exports = {
	CHARACTER_HISTORY_ACTIONS,
	getUsableHistoryCharacter,
	listCharacterHistoryKeys,
	popCharacterHistory,
	pushCharacterHistory,
	readCharacterHistory,
	restoreCharacterHistory,
	writeCharacterHistory,
	writePreparedCharacterHistory,
};

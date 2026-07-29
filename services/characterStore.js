const fs = require('node:fs/promises');
const Character = require('../models/Character');
const {
	serializeJson,
	writeJsonAtomically,
	writeSerializedJsonAtomically,
} = require('./atomicJsonFile');
const {
	getUsableHistoryCharacter,
	listCharacterHistoryKeys,
	popCharacterHistory,
	pushCharacterHistory,
	readCharacterHistory,
	restoreCharacterHistory,
	writePreparedCharacterHistory,
} = require('./characterHistoryStore');
const { runCharacterOperation } = require('./characterOperationQueue');
const {
	commitHistoryThenMutation,
	commitMutationThenHistory,
} = require('./characterPersistenceTransaction');
const { validateCharacterSaveSchema } = require('./characterSaveSchema');
const {
	characterSaveDirectory,
	getCharacterSavePath,
} = require('./characterStoragePaths');

async function createCharacter(name, creatorId, initialize = () => undefined) {
	return runCharacterOperation(name, async () => {
		const character = new Character(name, creatorId);
		await initialize(character);
		character.key = name;
		await saveCharacter(character, name, { exclusive: true });
		return character;
	});
}

async function deleteCharacter(name, canManage, historyContext = null) {
	return runCharacterOperation(name, async () => {
		const current = await readCharacterRecord(name);
		if (!canManage(current.character)) {
			const error = new Error('Only the character creator can delete it.');
			error.code = 'NOT_CHARACTER_OWNER';
			throw error;
		}

		if (!historyContext) {
			await fs.unlink(getCharacterSavePath(name));
			return;
		}

		const historyState = await readCharacterHistory(name);
		const nextHistory = pushCharacterHistory(
			historyState,
			current.rawSaveData,
			historyContext,
		);
		const serializedHistory = serializeJson(nextHistory.document);
		await commitHistoryThenMutation({
			characterKey: name,
			commitMutation: () => fs.unlink(getCharacterSavePath(name)),
			rollbackHistory: () => restoreCharacterHistory(historyState),
			writeHistory: () => writePreparedCharacterHistory(
				historyState.path,
				serializedHistory,
			),
		});
	});
}

async function updateCharacter(name, canManage, update, historyContext = null) {
	return runCharacterOperation(name, async () => {
		const current = await readCharacterRecord(name);
		const { character } = current;
		if (!canManage(character)) {
			const error = new Error('Only the character creator or a DM can edit it.');
			error.code = 'NOT_CHARACTER_EDITOR';
			throw error;
		}

		await update(character);
		validateCharacterSaveSchema(character);
		const serializedCharacter = serializeJson(character);
		if (!historyContext) {
			await writeSerializedJsonAtomically(
				getCharacterSavePath(name),
				serializedCharacter,
			);
			return character;
		}

		const historyState = await readCharacterHistory(name);
		const nextHistory = pushCharacterHistory(
			historyState,
			current.rawSaveData,
			historyContext,
		);
		const serializedHistory = serializeJson(nextHistory.document);
		await commitHistoryThenMutation({
			characterKey: name,
			commitMutation: () => writeSerializedJsonAtomically(
				getCharacterSavePath(name),
				serializedCharacter,
			),
			rollbackHistory: () => restoreCharacterHistory(historyState),
			writeHistory: () => writePreparedCharacterHistory(
				historyState.path,
				serializedHistory,
			),
		});
		return character;
	});
}

async function getCharacter(name) {
	return (await readCharacterRecord(name)).character;
}

async function listCharacters({ onLoadError = reportCharacterLoadError } = {}) {
	await fs.mkdir(characterSaveDirectory, { recursive: true });
	const entries = await fs.readdir(characterSaveDirectory, { withFileTypes: true });
	const characters = await Promise.all(entries
		.filter(entry => entry.isFile() && entry.name.endsWith('.json'))
		.map(async entry => {
			const key = entry.name.slice(0, -'.json'.length);
			try {
				return await getCharacter(key);
			}
			catch (error) {
				onLoadError(new CharacterLoadError(key, error));
				return null;
			}
		}));
	return characters
		.filter(Boolean)
		.sort((left, right) => left.key.localeCompare(right.key));
}

async function listUndoableCharacters(
	canManage,
	{ onLoadError = reportCharacterHistoryLoadError } = {},
) {
	const characterKeys = await listCharacterHistoryKeys();
	const characters = await Promise.all(characterKeys.map(characterKey => (
		runCharacterOperation(characterKey, async () => {
			try {
				const historyState = await readCharacterHistory(characterKey);
				const historyCharacter = getUsableHistoryCharacter(
					historyState,
					characterKey,
				);
				if (!historyCharacter) {
					return null;
				}

				let activeCharacter;
				try {
					activeCharacter = await getCharacter(characterKey);
				}
				catch (error) {
					if (error.code !== 'ENOENT') {
						throw error;
					}
					activeCharacter = null;
				}
				const authorizationCharacter = activeCharacter ?? historyCharacter;
				return canManage(authorizationCharacter)
					? authorizationCharacter
					: null;
			}
			catch (error) {
				onLoadError(new CharacterHistoryLoadError(characterKey, error));
				return null;
			}
		})
	)));
	return characters
		.filter(Boolean)
		.sort((left, right) => left.key.localeCompare(right.key));
}

async function undoCharacter(name, canManage, { maxEntries }) {
	return runCharacterOperation(name, async () => {
		let current = null;
		try {
			current = await readCharacterRecord(name);
		}
		catch (error) {
			if (error.code !== 'ENOENT') {
				throw error;
			}
		}

		if (current && !canManage(current.character)) {
			throw characterEditorError();
		}

		const historyState = await readCharacterHistory(name);
		const undo = popCharacterHistory(historyState, maxEntries, name);
		if (!current && !canManage(undo.character)) {
			throw characterEditorError();
		}

		validateCharacterSaveSchema(undo.character);
		const serializedCharacter = serializeJson(undo.character);
		const serializedHistory = serializeJson(undo.document);
		await commitMutationThenHistory({
			characterKey: name,
			commitMutation: () => writeSerializedJsonAtomically(
				getCharacterSavePath(name),
				serializedCharacter,
			),
			rollbackMutation: () => restoreCharacterRecord(name, current),
			writeHistory: () => writePreparedCharacterHistory(
				historyState.path,
				serializedHistory,
			),
		});
		return {
			action: undo.entry.action,
			actorId: undo.entry.actorId,
			character: undo.character,
			createdAt: undo.entry.createdAt,
		};
	});
}

class CharacterLoadError extends Error {
	constructor(characterKey, cause) {
		super(`Could not load character save "${characterKey}": ${cause.message}`, { cause });
		this.name = 'CharacterLoadError';
		this.code = 'INVALID_CHARACTER_SAVE';
		this.characterKey = characterKey;
	}
}

class CharacterHistoryLoadError extends Error {
	constructor(characterKey, cause) {
		super(`Could not load character history "${characterKey}": ${cause.message}`, {
			cause,
		});
		this.name = 'CharacterHistoryLoadError';
		this.code = 'INVALID_CHARACTER_HISTORY';
		this.characterKey = characterKey;
	}
}

function reportCharacterLoadError(error) {
	console.error(error);
}

function reportCharacterHistoryLoadError(error) {
	console.error(error);
}

async function saveCharacter(
	character,
	originalName = character.key,
	options = {},
) {
	validateCharacterSaveSchema(character);
	await writeJsonAtomically(getCharacterSavePath(originalName), character, options);
}

async function readCharacterRecord(name) {
	const serialized = await fs.readFile(getCharacterSavePath(name), 'utf8');
	const rawSaveData = JSON.parse(serialized);
	validateCharacterSaveSchema(rawSaveData);
	return {
		character: Character.fromSave(rawSaveData, name),
		rawSaveData,
		serialized,
	};
}

async function restoreCharacterRecord(name, record) {
	const savePath = getCharacterSavePath(name);
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

function characterEditorError() {
	const error = new Error('Only the character creator or a DM can edit it.');
	error.code = 'NOT_CHARACTER_EDITOR';
	return error;
}

module.exports = {
	CharacterHistoryLoadError,
	CharacterLoadError,
	createCharacter,
	deleteCharacter,
	getCharacter,
	listCharacters,
	listUndoableCharacters,
	undoCharacter,
	updateCharacter,
};

const Character = require('../models/Character');
const {
	deleteCharacterHistory,
	getUsableHistoryCharacter,
	listCharacterHistoryKeys,
	popCharacterHistory,
	pushCharacterHistory,
	readCharacterHistory,
	readCharacterHistoryFileState,
	restoreCharacterHistory,
	writePreparedCharacterHistory,
} = require('./characterHistoryStore');
const { validateCharacterSaveSchema } = require('./characterSaveSchema');
const { createConcreteEntityStore } = require('./concreteEntityStore');
const {
	characterSaveDirectory,
	getCharacterSavePath,
	validateCharacterKey,
} = require('./entityStoragePaths');

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

const store = createConcreteEntityStore({
	createEditorError: characterEditorError,
	createEntityInstance: (characterKey, creatorId) => (
		new Character(characterKey, creatorId)
	),
	createHistoryLoadError: (characterKey, cause) => (
		new CharacterHistoryLoadError(characterKey, cause)
	),
	createLoadError: (characterKey, cause) => (
		new CharacterLoadError(characterKey, cause)
	),
	createOwnerError: characterOwnerError,
	entityProperty: 'character',
	entityType: 'character',
	getSavePath: getCharacterSavePath,
	history: {
		delete: deleteCharacterHistory,
		getUsableEntity: getUsableHistoryCharacter,
		listKeys: listCharacterHistoryKeys,
		pop: popCharacterHistory,
		push: pushCharacterHistory,
		read: readCharacterHistory,
		readFileState: readCharacterHistoryFileState,
		restore: restoreCharacterHistory,
		writePrepared: writePreparedCharacterHistory,
	},
	hydrate: (rawSaveData, characterKey) => (
		Character.fromSave(rawSaveData, characterKey)
	),
	prepareCreatedEntity: (character, characterKey) => {
		character.key = characterKey;
	},
	reportHistoryLoadError: reportCharacterHistoryLoadError,
	reportLoadError: reportCharacterLoadError,
	saveDirectory: characterSaveDirectory,
	validateKey: validateCharacterKey,
	validateSave: validateCharacterSaveSchema,
});

function reportCharacterLoadError(error) {
	console.error(error);
}

function reportCharacterHistoryLoadError(error) {
	console.error(error);
}

function characterEditorError() {
	const error = new Error(
		'Only the character creator, a DM, or the server owner can edit it.',
	);
	error.code = 'NOT_CHARACTER_EDITOR';
	return error;
}

function characterOwnerError() {
	const error = new Error('Only the character creator can delete it.');
	error.code = 'NOT_CHARACTER_OWNER';
	return error;
}

module.exports = {
	CharacterHistoryLoadError,
	CharacterLoadError,
	createCharacter: store.create,
	deleteCharacter: store.delete,
	getCharacter: store.get,
	listCharacters: store.list,
	listUndoableCharacters: store.listUndoable,
	undoCharacter: store.undo,
	updateCharacter: store.update,
};

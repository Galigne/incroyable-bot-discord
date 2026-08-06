const Character = require('../models/Character');
const { validateCharacterSaveSchema } = require('./characterSaveSchema');
const { createEntityHistoryStore } = require('./entityHistoryStore');
const {
	characterHistoryDirectory,
	getCharacterHistoryPath,
	validateCharacterKey,
} = require('./entityStoragePaths');

const CHARACTER_HISTORY_ACTIONS = new Set([
	'set',
	'damage',
	'heal',
	'end-turn',
]);
const STORED_CHARACTER_HISTORY_ACTIONS = new Set([
	...CHARACTER_HISTORY_ACTIONS,
	'delete',
]);

const historyStore = createEntityHistoryStore({
	actions: CHARACTER_HISTORY_ACTIONS,
	createDocument: entries => ({ entries }),
	createHistoryError,
	entityLabel: 'character',
	entityProperty: 'character',
	getHistoryPath: getCharacterHistoryPath,
	historyDirectory: characterHistoryDirectory,
	hydrateSnapshot: (snapshot, characterKey) => (
		Character.fromSave(snapshot, characterKey)
	),
	storedActions: STORED_CHARACTER_HISTORY_ACTIONS,
	validateDocumentEnvelope: document => {
		if (
			!document
			|| typeof document !== 'object'
			|| Array.isArray(document)
			|| !Array.isArray(document.entries)
		) {
			throw new TypeError('Character history must contain an entries array.');
		}
	},
	validateKey: validateCharacterKey,
	validateSnapshot: validateCharacterSaveSchema,
});

function createHistoryError(code, message, cause) {
	const error = new Error(message, cause ? { cause } : undefined);
	error.name = 'CharacterHistoryError';
	error.code = code;
	return error;
}

module.exports = {
	CHARACTER_HISTORY_ACTIONS,
	deleteCharacterHistory: historyStore.deleteHistory,
	getUsableHistoryCharacter: historyStore.getUsableHistoryEntity,
	listCharacterHistoryKeys: historyStore.listHistoryKeys,
	popCharacterHistory: historyStore.popHistory,
	pushCharacterHistory: historyStore.pushHistory,
	readCharacterHistory: historyStore.readHistory,
	readCharacterHistoryFileState: historyStore.readHistoryFileState,
	restoreCharacterHistory: historyStore.restoreHistory,
	writePreparedCharacterHistory: historyStore.writePreparedHistory,
};

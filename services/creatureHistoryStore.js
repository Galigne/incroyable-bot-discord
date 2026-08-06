const Creature = require('../models/Creature');
const { validateCreatureSaveSchema } = require('./creatureSaveSchema');
const { createEntityHistoryStore } = require('./entityHistoryStore');
const {
	creatureHistoryDirectory,
	getCreatureHistoryPath,
	validateEntityKey,
} = require('./entityStoragePaths');

const CREATURE_HISTORY_ACTIONS = new Set([
	'set',
	'damage',
	'heal',
	'end-turn',
]);

const historyStore = createEntityHistoryStore({
	actions: CREATURE_HISTORY_ACTIONS,
	createDocument: entries => ({
		schemaVersion: 1,
		type: 'creature',
		entries,
	}),
	createHistoryError,
	entityLabel: 'creature',
	entityProperty: 'creature',
	getHistoryPath: getCreatureHistoryPath,
	historyDirectory: creatureHistoryDirectory,
	hydrateSnapshot: (snapshot, entityKey) => Creature.fromSave(snapshot, entityKey),
	validateDocumentEnvelope: document => {
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
	},
	validateKey: validateEntityKey,
	validateSnapshot: validateCreatureSaveSchema,
});

function createHistoryError(code, message, cause) {
	const error = new Error(message, cause ? { cause } : undefined);
	error.name = 'CreatureHistoryError';
	error.code = code;
	return error;
}

module.exports = {
	CREATURE_HISTORY_ACTIONS,
	deleteCreatureHistory: historyStore.deleteHistory,
	getUsableHistoryCreature: historyStore.getUsableHistoryEntity,
	listCreatureHistoryKeys: historyStore.listHistoryKeys,
	popCreatureHistory: historyStore.popHistory,
	pushCreatureHistory: historyStore.pushHistory,
	readCreatureHistory: historyStore.readHistory,
	readCreatureHistoryFileState: historyStore.readHistoryFileState,
	restoreCreatureHistory: historyStore.restoreHistory,
	writePreparedCreatureHistory: historyStore.writePreparedHistory,
};

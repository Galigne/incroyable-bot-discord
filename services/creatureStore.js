const Creature = require('../models/Creature');
const { createConcreteEntityStore } = require('./concreteEntityStore');
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
const { validateCreatureSaveSchema } = require('./creatureSaveSchema');
const {
	creatureSaveDirectory,
	getCreatureSavePath,
	validateEntityKey,
} = require('./entityStoragePaths');

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

const store = createConcreteEntityStore({
	createEditorError: creatureEditorError,
	createEntityInstance: (entityKey, access) => (
		new Creature(entityKey, access)
	),
	createHistoryLoadError: (entityKey, cause) => (
		new CreatureHistoryLoadError(entityKey, cause)
	),
	createLoadError: (entityKey, cause) => new CreatureLoadError(entityKey, cause),
	createOwnerError: creatureOwnerError,
	entityProperty: 'creature',
	entityType: 'creature',
	getSavePath: getCreatureSavePath,
	history: {
		delete: deleteCreatureHistory,
		getUsableEntity: getUsableHistoryCreature,
		listKeys: listCreatureHistoryKeys,
		pop: popCreatureHistory,
		push: pushCreatureHistory,
		read: readCreatureHistory,
		readFileState: readCreatureHistoryFileState,
		restore: restoreCreatureHistory,
		writePrepared: writePreparedCreatureHistory,
	},
	hydrate: (rawSaveData, entityKey) => Creature.fromSave(rawSaveData, entityKey),
	reportHistoryLoadError: reportCreatureHistoryLoadError,
	reportLoadError: reportCreatureLoadError,
	saveDirectory: creatureSaveDirectory,
	validateKey: validateEntityKey,
	validateSave: validateCreatureSaveSchema,
});

function reportCreatureLoadError(error) {
	console.error(error);
}

function reportCreatureHistoryLoadError(error) {
	console.error(error);
}

function creatureEditorError() {
	const error = new Error(
		'Only an authorized creature user, a DM, or the server owner can edit it.',
	);
	error.code = 'NOT_CREATURE_EDITOR';
	return error;
}

function creatureOwnerError() {
	const error = new Error(
		'Only a creature owner, a DM, or the server owner can delete it.',
	);
	error.code = 'NOT_CREATURE_OWNER';
	return error;
}

module.exports = {
	CreatureHistoryLoadError,
	CreatureLoadError,
	createCreature: store.create,
	deleteCreature: store.delete,
	getCreature: store.get,
	listCreatures: store.list,
	listUndoableCreatures: store.listUndoable,
	undoCreature: store.undo,
	updateCreature: store.update,
};

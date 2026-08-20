const characterStore = require('./characterStore');
const creatureStore = require('./creatureStore');
const {
	getCharacterHistoryPath,
	getCreatureHistoryPath,
	validateEntityKey,
} = require('./entityStoragePaths');
const { getStoredEntityTypes, pathExists } = require('./entityKeyRegistry');
const { ENTITY_TYPES, assertEntityType } = require('./entityType');

const storesByType = Object.freeze({
	character: {
		create: characterStore.createCharacter,
		delete: characterStore.deleteCharacter,
		get: characterStore.getCharacter,
		list: characterStore.listCharacters,
		listUndoable: characterStore.listUndoableCharacters,
		undo: characterStore.undoCharacter,
		update: characterStore.updateCharacter,
	},
	creature: {
		create: creatureStore.createCreature,
		delete: creatureStore.deleteCreature,
		get: creatureStore.getCreature,
		list: creatureStore.listCreatures,
		listUndoable: creatureStore.listUndoableCreatures,
		undo: creatureStore.undoCreature,
		update: creatureStore.updateCreature,
	},
});

async function createEntity(entityKey, type = 'character', access = [], initialize) {
	validateEntityKey(entityKey);
	return getTypeStore(type).create(entityKey, access, initialize);
}

async function deleteEntity(entityKey, canManage) {
	const type = await getEntityType(entityKey);
	return getTypeStore(type).delete(entityKey, canManage);
}

async function getEntity(entityKey) {
	const type = await getEntityType(entityKey);
	return getTypeStore(type).get(entityKey);
}

async function updateEntity(entityKey, canManage, update, historyContext) {
	const type = await getEntityType(entityKey);
	return getTypeStore(type).update(entityKey, canManage, update, historyContext);
}

async function listEntities(options = {}) {
	const [characters, creatures] = await Promise.all([
		storesByType.character.list(options.character),
		storesByType.creature.list(options.creature),
	]);
	assertNoDuplicateKeys([...characters, ...creatures]);
	return [...characters, ...creatures]
		.sort((left, right) => left.key.localeCompare(right.key));
}

async function listUndoableEntities(canManage, options = {}) {
	const [characters, creatures] = await Promise.all([
		storesByType.character.listUndoable(canManage, options.character),
		storesByType.creature.listUndoable(canManage, options.creature),
	]);
	assertNoDuplicateKeys([...characters, ...creatures]);
	return [...characters, ...creatures]
		.sort((left, right) => left.key.localeCompare(right.key));
}

async function undoEntity(entityKey, canManage, options) {
	const type = await getUndoEntityType(entityKey);
	return getTypeStore(type).undo(entityKey, canManage, options);
}

function getTypeStore(type) {
	assertEntityType(type);
	return storesByType[type];
}

async function getEntityType(entityKey) {
	const types = await getStoredEntityTypes(entityKey);
	return requireSingleType(entityKey, types);
}

async function getUndoEntityType(entityKey) {
	const storedTypes = await getStoredEntityTypes(entityKey);
	if (storedTypes.length > 0) {
		return requireSingleType(entityKey, storedTypes);
	}
	const [characterHistory, creatureHistory] = await Promise.all([
		pathExists(getCharacterHistoryPath(entityKey)),
		pathExists(getCreatureHistoryPath(entityKey)),
	]);
	return requireSingleType(entityKey, [
		...(characterHistory ? ['character'] : []),
		...(creatureHistory ? ['creature'] : []),
	]);
}

function requireSingleType(entityKey, types) {
	if (types.length === 0) {
		const error = new Error(`Entity "${entityKey}" does not exist.`);
		error.code = 'ENOENT';
		throw error;
	}
	if (types.length > 1) {
		const error = new Error(`Entity key "${entityKey}" exists for multiple types.`);
		error.code = 'ENTITY_KEY_COLLISION';
		throw error;
	}
	return types[0];
}

function assertNoDuplicateKeys(entities) {
	const seen = new Set();
	for (const entity of entities) {
		if (seen.has(entity.key)) {
			const error = new Error(`Entity key "${entity.key}" exists for multiple types.`);
			error.code = 'ENTITY_KEY_COLLISION';
			throw error;
		}
		seen.add(entity.key);
	}
}

module.exports = {
	ENTITY_TYPES,
	createEntity,
	deleteEntity,
	getEntity,
	getEntityType,
	listEntities,
	listUndoableEntities,
	undoEntity,
	updateEntity,
};

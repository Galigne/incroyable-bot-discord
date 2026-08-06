const characterStore = require('./characterStore');
const creatureStore = require('./creatureStore');
const {
	getCharacterHistoryPath,
	getCreatureHistoryPath,
	validateEntityKey,
} = require('./entityStoragePaths');
const { getStoredEntityTypes, pathExists } = require('./entityKeyRegistry');

const ENTITY_TYPES = Object.freeze(['character', 'creature']);

async function createEntity(entityKey, type, creatorId, initialize) {
	validateEntityKey(entityKey);
	if (!ENTITY_TYPES.includes(type)) {
		const error = new Error(`Unsupported entity type: ${type}.`);
		error.code = 'INVALID_ENTITY_TYPE';
		throw error;
	}
	return type === 'creature'
		? creatureStore.createCreature(entityKey, creatorId, initialize)
		: characterStore.createCharacter(entityKey, creatorId, initialize);
}

async function deleteEntity(entityKey, canManage) {
	const type = await getEntityType(entityKey);
	return type === 'creature'
		? creatureStore.deleteCreature(entityKey, canManage)
		: characterStore.deleteCharacter(entityKey, canManage);
}

async function getEntity(entityKey) {
	const type = await getEntityType(entityKey);
	return type === 'creature'
		? creatureStore.getCreature(entityKey)
		: characterStore.getCharacter(entityKey);
}

async function updateEntity(entityKey, canManage, update, historyContext) {
	const type = await getEntityType(entityKey);
	return type === 'creature'
		? creatureStore.updateCreature(entityKey, canManage, update, historyContext)
		: characterStore.updateCharacter(entityKey, canManage, update, historyContext);
}

async function listEntities(options = {}) {
	const [characters, creatures] = await Promise.all([
		characterStore.listCharacters(options.character),
		creatureStore.listCreatures(options.creature),
	]);
	assertNoDuplicateKeys([...characters, ...creatures]);
	return [...characters, ...creatures]
		.sort((left, right) => left.key.localeCompare(right.key));
}

async function listUndoableEntities(canManage, options = {}) {
	const [characters, creatures] = await Promise.all([
		characterStore.listUndoableCharacters(canManage, options.character),
		creatureStore.listUndoableCreatures(canManage, options.creature),
	]);
	assertNoDuplicateKeys([...characters, ...creatures]);
	return [...characters, ...creatures]
		.sort((left, right) => left.key.localeCompare(right.key));
}

async function undoEntity(entityKey, canManage, options) {
	const type = await getUndoEntityType(entityKey);
	return type === 'creature'
		? creatureStore.undoCreature(entityKey, canManage, options)
		: characterStore.undoCharacter(entityKey, canManage, options);
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

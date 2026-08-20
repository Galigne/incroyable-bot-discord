const ENTITY_ACCESS_LEVELS = Object.freeze(['owner', 'partial']);
const ENTITY_ACCESS_OPERATIONS = Object.freeze([
	...ENTITY_ACCESS_LEVELS,
	'none',
]);

function validateEntityAccess(access, createError = message => new TypeError(message)) {
	if (!Array.isArray(access)) {
		throw createError('access must be an array.');
	}
	const userIds = new Set();
	for (const [index, entry] of access.entries()) {
		const path = `access[${index}]`;
		if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
			throw createError(`${path} must be an object.`);
		}
		const keys = Object.keys(entry);
		if (
			keys.length !== 2
			|| !Object.hasOwn(entry, 'userId')
			|| !Object.hasOwn(entry, 'level')
		) {
			throw createError(`${path} must contain exactly userId and level.`);
		}
		assertUserId(entry.userId, `${path}.userId`, createError);
		if (!ENTITY_ACCESS_LEVELS.includes(entry.level)) {
			throw createError(`${path}.level must be owner or partial.`);
		}
		if (userIds.has(entry.userId)) {
			throw createError(`access contains duplicate user ID ${entry.userId}.`);
		}
		userIds.add(entry.userId);
	}
	return access;
}

function createOwnerAccess(userId) {
	assertUserId(userId, 'userId');
	return [{ userId, level: 'owner' }];
}

function getEntityAccessLevel(entity, userId) {
	if (!Array.isArray(entity?.access) || typeof userId !== 'string') {
		return null;
	}
	return entity.access.find(entry => entry.userId === userId)?.level ?? null;
}

function setEntityUserAccess(entity, userId, level) {
	if (!entity || typeof entity !== 'object') {
		throw accessOperationError('An entity is required.');
	}
	assertUserId(userId, 'userId', accessOperationError);
	if (!ENTITY_ACCESS_OPERATIONS.includes(level)) {
		throw accessOperationError('Access level must be owner, partial, or none.');
	}
	validateEntityAccess(entity.access, accessOperationError);

	const entryIndex = entity.access.findIndex(entry => entry.userId === userId);
	const previousLevel = entryIndex === -1
		? 'none'
		: entity.access[entryIndex].level;
	if (previousLevel === level) {
		return { changed: false, level, previousLevel, userId };
	}
	if (level === 'none') {
		entity.access.splice(entryIndex, 1);
	}
	else if (entryIndex === -1) {
		entity.access.push({ userId, level });
	}
	else {
		entity.access[entryIndex].level = level;
	}
	return { changed: true, level, previousLevel, userId };
}

function assertUserId(userId, path, createError = message => new TypeError(message)) {
	if (typeof userId !== 'string' || !userId.trim()) {
		throw createError(`${path} must be a non-empty Discord user ID.`);
	}
}

function accessOperationError(message) {
	const error = new Error(message);
	error.name = 'EntityAccessError';
	error.code = 'INVALID_ENTITY_ACCESS_OPERATION';
	return error;
}

module.exports = {
	ENTITY_ACCESS_LEVELS,
	ENTITY_ACCESS_OPERATIONS,
	createOwnerAccess,
	getEntityAccessLevel,
	setEntityUserAccess,
	validateEntityAccess,
};

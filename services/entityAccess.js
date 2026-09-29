const ENTITY_ACCESS_LEVELS = Object.freeze(['owner', 'partial']);
function validateEntityAccess(
	access,
	createError = message => new TypeError(message),
	pathPrefix = 'access',
) {
	if (!Array.isArray(access)) {
		throw createError(`${pathPrefix} must be an array.`);
	}
	const userIds = new Set();
	for (const [index, entry] of access.entries()) {
		const path = `${pathPrefix}[${index}]`;
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
			throw createError(`${pathPrefix} contains duplicate user ID ${entry.userId}.`);
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
	if (!Array.isArray(entity?.settings?.access) || typeof userId !== 'string') {
		return null;
	}
	return entity.settings.access.find(entry => entry.userId === userId)?.level ?? null;
}

function assertUserId(userId, path, createError = message => new TypeError(message)) {
	if (typeof userId !== 'string' || !userId.trim()) {
		throw createError(`${path} must be a non-empty Discord user ID.`);
	}
}

module.exports = {
	ENTITY_ACCESS_LEVELS,
	createOwnerAccess,
	getEntityAccessLevel,
	validateEntityAccess,
};

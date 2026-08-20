const ENTITY_ACCESS_LEVELS = Object.freeze(['owner', 'partial']);
const ENTITY_ACCESS_OPERATIONS = Object.freeze([
	...ENTITY_ACCESS_LEVELS,
	'none',
]);
const DISCORD_USER_ID_PATTERN = /^\d{17,20}$/;

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

function resolveEntityAccessRequest({
	level = null,
	rawUserId = null,
	selectedUserId = null,
} = {}) {
	const hasLevel = level !== null && level !== undefined;
	const hasRawUserId = rawUserId !== null && rawUserId !== undefined;
	const hasSelectedUser = selectedUserId !== null && selectedUserId !== undefined;
	const targetCount = Number(hasRawUserId) + Number(hasSelectedUser);
	if (targetCount === 0 && !hasLevel) {
		return { kind: 'list' };
	}
	if (targetCount !== 1 || !hasLevel) {
		throw entityAccessError(
			'INVALID_ENTITY_ACCESS_REQUEST',
			'An access update requires a level and exactly one user target.',
		);
	}
	if (!ENTITY_ACCESS_OPERATIONS.includes(level)) {
		throw accessOperationError('Access level must be owner, partial, or none.');
	}
	if (hasRawUserId) {
		const normalizedUserId = typeof rawUserId === 'string'
			? rawUserId.trim()
			: '';
		if (!DISCORD_USER_ID_PATTERN.test(normalizedUserId)) {
			throw entityAccessError(
				'INVALID_DISCORD_USER_ID',
				'Raw user IDs must contain 17 to 20 digits.',
			);
		}
		return { kind: 'update', level, userId: normalizedUserId };
	}
	assertUserId(selectedUserId, 'selectedUserId', message => entityAccessError(
		'INVALID_ENTITY_ACCESS_REQUEST',
		message,
	));
	return { kind: 'update', level, userId: selectedUserId };
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
	return entityAccessError('INVALID_ENTITY_ACCESS_OPERATION', message);
}

function entityAccessError(code, message) {
	const error = new Error(message);
	error.name = 'EntityAccessError';
	error.code = code;
	return error;
}

module.exports = {
	ENTITY_ACCESS_LEVELS,
	ENTITY_ACCESS_OPERATIONS,
	createOwnerAccess,
	getEntityAccessLevel,
	resolveEntityAccessRequest,
	setEntityUserAccess,
	validateEntityAccess,
};

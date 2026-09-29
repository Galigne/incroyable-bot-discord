const { validateEntityKey } = require('./entityStoragePaths');
const {
	createOwnerAccess,
	validateEntityAccess,
} = require('./entityAccess');

const ENTITY_VISIBILITIES = Object.freeze(['public', 'private']);
const DISCORD_USER_ID_PATTERN = /^\d{17,20}$/;

function createEntitySettings(visibility = 'public', access = []) {
	const settings = {
		visibility,
		access: structuredClone(access),
	};
	validateEntitySettings(settings);
	return settings;
}

function createOwnedPublicSettings(userId) {
	return createEntitySettings('public', createOwnerAccess(userId));
}

function normalizeInitialEntitySettings(settings) {
	return Array.isArray(settings)
		? createEntitySettings('public', settings)
		: settings ?? createEntitySettings();
}

function validateEntitySettings(
	settings,
	createError = message => new TypeError(message),
) {
	if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
		throw createError('settings must be an object.');
	}
	const keys = Object.keys(settings);
	if (
		keys.length !== 2
		|| !Object.hasOwn(settings, 'visibility')
		|| !Object.hasOwn(settings, 'access')
	) {
		throw createError('settings must contain exactly visibility and access.');
	}
	if (!ENTITY_VISIBILITIES.includes(settings.visibility)) {
		throw createError('settings.visibility must be public or private.');
	}
	validateEntityAccess(settings.access, createError, 'settings.access');
	return settings;
}

function serializeEntitySettings(entity) {
	validateEntitySettings(entity?.settings);
	return {
		'settings.key': entity.key,
		'settings.visibility': entity.settings.visibility,
		'settings.access': entity.settings.access
			.map(entry => `${entry.userId}:${entry.level}`)
			.join('\n'),
	};
}

function parseEntitySettingsSubmission(submittedValue) {
	if (
		!submittedValue
		|| typeof submittedValue !== 'object'
		|| Array.isArray(submittedValue)
	) {
		throw settingsError('errors.settingsGroupMissing');
	}
	for (const field of ['settings.key', 'settings.visibility', 'settings.access']) {
		if (typeof submittedValue[field] !== 'string') {
			throw settingsError('errors.settingsGroupMissing');
		}
	}

	const key = submittedValue['settings.key'].trim();
	try {
		validateEntityKey(key);
	}
	catch (error) {
		throw settingsError('errors.invalidEntityKey', {}, error);
	}
	const visibility = submittedValue['settings.visibility'].trim();
	if (!ENTITY_VISIBILITIES.includes(visibility)) {
		throw settingsError('errors.invalidVisibility');
	}
	const settings = createEntitySettings(
		visibility,
		parseAccessLines(submittedValue['settings.access']),
	);
	return { key, settings };
}

function parseAccessLines(value) {
	const access = [];
	const userIds = new Set();
	for (const line of value.split(/\r?\n/).map(item => item.trim()).filter(Boolean)) {
		const parts = line.split(':');
		if (parts.length !== 2) {
			throw settingsError('errors.invalidSettingsAccessLine');
		}
		const userId = parts[0].trim();
		const level = parts[1].trim();
		if (!DISCORD_USER_ID_PATTERN.test(userId)) {
			throw settingsError('errors.invalidSettingsUserId');
		}
		if (!['owner', 'partial'].includes(level)) {
			throw settingsError('errors.invalidSettingsAccessLevel');
		}
		if (userIds.has(userId)) {
			throw settingsError('errors.duplicateSettingsUser');
		}
		userIds.add(userId);
		access.push({ userId, level });
	}
	return access;
}

function settingsError(translationKey, translationVariables = {}, cause) {
	const error = new Error(translationKey, cause ? { cause } : undefined);
	error.name = 'EntitySettingsError';
	error.code = 'INVALID_ENTITY_SETTINGS';
	error.translationKey = translationKey;
	error.translationVariables = translationVariables;
	return error;
}

module.exports = {
	ENTITY_VISIBILITIES,
	createEntitySettings,
	createOwnedPublicSettings,
	normalizeInitialEntitySettings,
	parseEntitySettingsSubmission,
	serializeEntitySettings,
	validateEntitySettings,
};

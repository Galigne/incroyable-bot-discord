const { normalizeLocale, t } = require('./i18n');

const SUPPORTED_LOCALES = new Set(['en', 'fr']);
const ROLE_KEYS = new Set(['dm', 'moderator']);

class ConfigurationError extends Error {
	constructor(field, reason = 'missing') {
		super(`Invalid configuration field "${field}": ${reason}.`);
		this.name = 'ConfigurationError';
		this.code = 'INVALID_CONFIGURATION';
		this.field = field;
		this.reason = reason;
	}
}

function validateConfig(config) {
	if (!config || typeof config !== 'object' || Array.isArray(config)) {
		throw new ConfigurationError('config', 'invalid');
	}
	if (!Object.hasOwn(config, 'locale')) {
		throw new ConfigurationError('locale');
	}
	if (!SUPPORTED_LOCALES.has(config.locale)) {
		throw new ConfigurationError('locale', 'unsupported');
	}
	requireNonEmptyString(config, 'botUserId');
	if (!config.roles || typeof config.roles !== 'object' || Array.isArray(config.roles)) {
		throw new ConfigurationError('roles');
	}
	requireNonEmptyString(config.roles, 'dm', 'roles.dm');
	requireNonEmptyString(config.roles, 'moderator', 'roles.moderator');

	for (const role of Object.keys(config.roles)) {
		if (!ROLE_KEYS.has(role)) {
			throw new ConfigurationError(`roles.${role}`, 'obsolete');
		}
	}

	if (config.channels !== undefined) {
		if (
			!config.channels
			|| typeof config.channels !== 'object'
			|| Array.isArray(config.channels)
		) {
			throw new ConfigurationError('channels', 'invalid');
		}
		if (Object.hasOwn(config.channels, 'teamVoice')) {
			requireNonEmptyString(config.channels, 'teamVoice', 'channels.teamVoice');
		}
	}
	return config;
}

function getConfigurationErrorMessage(error, config = {}) {
	const locale = normalizeLocale(config.locale);
	if (!(error instanceof ConfigurationError)) {
		return t(locale, 'authorization.invalidConfiguration', { field: 'config' });
	}
	const translationKey = error.reason === 'obsolete'
		? 'authorization.obsoleteConfiguration'
		: 'authorization.invalidConfiguration';
	return t(locale, translationKey, { field: error.field });
}

function requireNonEmptyString(object, property, field = property) {
	if (
		!Object.hasOwn(object, property)
		|| typeof object[property] !== 'string'
		|| object[property].trim() === ''
	) {
		throw new ConfigurationError(field);
	}
}

module.exports = {
	ConfigurationError,
	SUPPORTED_LOCALES,
	getConfigurationErrorMessage,
	validateConfig,
};

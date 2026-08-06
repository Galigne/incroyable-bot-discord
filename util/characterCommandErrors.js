const { MessageFlags } = require('discord.js');
const { MAX_AP } = require('../services/mechanics/constants');
const {
	getCharacterFieldLabel,
	getResourceAbbreviation,
} = require('./characterDisplay');
const { t } = require('./i18n');

const replyableErrorCodes = new Set([
	'EEXIST',
	'ENOENT',
	'INVALID_CHARACTER_EDIT',
	'INVALID_CHARACTER_HISTORY',
	'INVALID_CHARACTER_HISTORY_SNAPSHOT',
	'INVALID_CHARACTER_NAME',
	'INVALID_RANDOM_CHARACTER',
	'NO_CHARACTER_HISTORY',
	'NOT_CHARACTER_EDITOR',
	'NOT_CHARACTER_OWNER',
	'UNSUPPORTED_CHARACTER_HISTORY_SCHEMA',
	'CHARACTER_HISTORY_CONSISTENCY_FAILED',
	'CHARACTER_HISTORY_PERSISTENCE_FAILED',
	'CHARACTER_DELETION_CONSISTENCY_FAILED',
	'CHARACTER_DELETION_PERSISTENCE_FAILED',
]);

async function replyToCharacterError(interaction, error, locale = 'en') {
	if (!replyableErrorCodes.has(error.code)) {
		return false;
	}

	const responses = {
		EEXIST: t(locale, 'errors.entityExists'),
		ENOENT: t(locale, 'errors.characterMissing'),
		INVALID_CHARACTER_NAME: t(locale, 'errors.invalidCharacterKey'),
		INVALID_CHARACTER_HISTORY: t(locale, 'rpg.undo.errors.invalidBackup'),
		INVALID_CHARACTER_HISTORY_SNAPSHOT: t(locale, 'rpg.undo.errors.invalidBackup'),
		NO_CHARACTER_HISTORY: t(locale, 'rpg.undo.errors.noHistory'),
		NOT_CHARACTER_EDITOR: t(locale, 'errors.characterEditor'),
		NOT_CHARACTER_OWNER: t(locale, 'errors.characterOwnerDelete'),
		UNSUPPORTED_CHARACTER_HISTORY_SCHEMA: t(
			locale,
			'rpg.undo.errors.unsupportedSchema',
		),
		CHARACTER_HISTORY_CONSISTENCY_FAILED: t(
			locale,
			'rpg.undo.errors.operationFailed',
		),
		CHARACTER_HISTORY_PERSISTENCE_FAILED: t(
			locale,
			'rpg.undo.errors.operationFailed',
		),
		CHARACTER_DELETION_CONSISTENCY_FAILED: t(
			locale,
			'rpg.delete.operationFailed',
		),
		CHARACTER_DELETION_PERSISTENCE_FAILED: t(
			locale,
			'rpg.delete.operationFailed',
		),
	};
	const response = error.translationKey
		? translateCharacterOutcome(error, locale)
		: responses[error.code] ?? error.message;
	await interaction.reply({ content: response, flags: MessageFlags.Ephemeral });
	return true;
}

function translateCharacterOutcome(outcome, locale = 'en') {
	return t(
		locale,
		outcome.translationKey,
		getCharacterTranslationVariables(locale, outcome.translationVariables),
	);
}

function getCharacterTranslationVariables(locale, variables = {}) {
	const translated = {
		...variables,
		apLabel: getResourceAbbreviation(locale, 'ap'),
		arLabel: getResourceAbbreviation(locale, 'ar'),
		hpLabel: getResourceAbbreviation(locale, 'hp'),
		max: variables.max ?? MAX_AP,
	};
	if (variables.fieldId) {
		translated.field = getCharacterFieldLabel(locale, variables.fieldId);
		delete translated.fieldId;
	}
	if (variables.componentFieldId) {
		translated.component = getCharacterFieldLabel(
			locale,
			variables.componentFieldId,
		);
		delete translated.componentFieldId;
	}
	if (variables.formatFieldIds) {
		translated.format = variables.formatFieldIds
			.map(fieldId => getCharacterFieldLabel(locale, fieldId))
			.join(':');
		delete translated.formatFieldIds;
	}
	return translated;
}

module.exports = {
	getCharacterTranslationVariables,
	replyToCharacterError,
	translateCharacterOutcome,
};

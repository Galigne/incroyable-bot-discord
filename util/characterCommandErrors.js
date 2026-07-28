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
	'INVALID_CHARACTER_NAME',
	'INVALID_RANDOM_CHARACTER',
	'NOT_CHARACTER_EDITOR',
	'NOT_CHARACTER_OWNER',
]);

async function replyToCharacterError(interaction, error, locale = 'en') {
	if (!replyableErrorCodes.has(error.code)) {
		return false;
	}

	const responses = {
		EEXIST: t(locale, 'errors.characterExists'),
		ENOENT: t(locale, 'errors.characterMissing'),
		INVALID_CHARACTER_NAME: t(locale, 'errors.invalidCharacterKey'),
		NOT_CHARACTER_EDITOR: t(locale, 'errors.characterEditor'),
		NOT_CHARACTER_OWNER: t(locale, 'errors.characterOwnerDelete'),
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
	return translated;
}

module.exports = {
	getCharacterTranslationVariables,
	replyToCharacterError,
	translateCharacterOutcome,
};

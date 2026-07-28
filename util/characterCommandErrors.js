const { MessageFlags } = require('discord.js');
const { t } = require('./i18n');

const replyableErrorCodes = new Set([
	'EEXIST',
	'ENOENT',
	'INVALID_CHARACTER_EDIT',
	'INVALID_CHARACTER_NAME',
	'INVALID_RANDOM_CHARACTER',
	'NOT_CHARACTER_EDITOR',
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
	};
	const response = error.translationKey
		? t(locale, error.translationKey, error.translationVariables)
		: responses[error.code] ?? error.message;
	await interaction.reply({ content: response, flags: MessageFlags.Ephemeral });
	return true;
}

module.exports = { replyToCharacterError };

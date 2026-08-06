const { MessageFlags } = require('discord.js');
const { t } = require('./i18n');

const replyableErrorCodes = new Set([
	'EEXIST',
	'INVALID_CHARACTER_NAME',
	'INVALID_RANDOM_CHARACTER',
]);

async function replyToCharacterError(interaction, error, locale = 'en') {
	if (!replyableErrorCodes.has(error.code)) {
		return false;
	}

	const responses = {
		EEXIST: t(locale, 'errors.entityExists'),
		INVALID_CHARACTER_NAME: t(locale, 'errors.invalidCharacterKey'),
	};
	const response = responses[error.code] ?? error.message;
	await interaction.reply({ content: response, flags: MessageFlags.Ephemeral });
	return true;
}

module.exports = {
	replyToCharacterError,
};

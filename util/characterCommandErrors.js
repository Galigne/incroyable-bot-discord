const replyableErrorCodes = new Set([
	'EEXIST',
	'ENOENT',
	'INVALID_CHARACTER_EDIT',
	'INVALID_CHARACTER_NAME',
	'INVALID_RANDOM_CHARACTER',
	'NOT_CHARACTER_EDITOR',
]);

async function replyToCharacterError(interaction, error) {
	if (!replyableErrorCodes.has(error.code)) {
		return false;
	}

	const responses = {
		EEXIST: 'A character with that key already exists.',
		ENOENT: 'That character does not exist.',
	};
	const response = responses[error.code] ?? error.message;
	await interaction.reply({ content: response, ephemeral: true });
	return true;
}

module.exports = { replyToCharacterError };

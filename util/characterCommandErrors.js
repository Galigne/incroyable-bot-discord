const replyableErrorCodes = new Set([
	'EEXIST',
	'ENOENT',
	'INVALID_CHARACTER_EDIT',
	'INVALID_CHARACTER_NAME',
	'NOT_CHARACTER_EDITOR',
]);

async function replyToCharacterError(message, error) {
	if (!replyableErrorCodes.has(error.code)) {
		return false;
	}

	const response = error.code === 'ENOENT'
		? 'That character does not exist.'
		: error.message;
	await message.reply(response);
	return true;
}

module.exports = { replyToCharacterError };

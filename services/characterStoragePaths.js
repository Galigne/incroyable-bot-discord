const path = require('node:path');

const characterSaveDirectory = process.env.INCREDIBLE_BOT_SAVE_DIRECTORY
	? path.resolve(process.env.INCREDIBLE_BOT_SAVE_DIRECTORY)
	: path.join(__dirname, '..', 'save');
const characterHistoryDirectory = path.join(characterSaveDirectory, '.history');

function getCharacterSavePath(characterKey) {
	validateCharacterKey(characterKey);
	return path.join(characterSaveDirectory, `${characterKey}.json`);
}

function getCharacterHistoryPath(characterKey) {
	validateCharacterKey(characterKey);
	return path.join(characterHistoryDirectory, `${characterKey}.json`);
}

function validateCharacterKey(characterKey) {
	if (
		!characterKey
		|| !/^[\p{L}\p{N}](?:[\p{L}\p{N}_.-]{0,48}[\p{L}\p{N}])?$/u.test(
			characterKey,
		)
	) {
		const error = new Error(
			'Character keys must start and end with a letter or number and may '
			+ 'contain letters, numbers, periods, hyphens, and underscores.',
		);
		error.code = 'INVALID_CHARACTER_NAME';
		throw error;
	}
}

module.exports = {
	characterHistoryDirectory,
	characterSaveDirectory,
	getCharacterHistoryPath,
	getCharacterSavePath,
	validateCharacterKey,
};

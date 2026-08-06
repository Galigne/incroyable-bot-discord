const path = require('node:path');

const characterSaveDirectory = process.env.INCREDIBLE_BOT_SAVE_DIRECTORY
	? path.resolve(process.env.INCREDIBLE_BOT_SAVE_DIRECTORY)
	: path.join(__dirname, '..', 'save');
const characterHistoryDirectory = path.join(characterSaveDirectory, '.history');
const creatureSaveDirectory = path.join(characterSaveDirectory, 'creatures');
const creatureHistoryDirectory = path.join(
	characterHistoryDirectory,
	'creatures',
);

function getCharacterSavePath(characterKey) {
	validateCharacterKey(characterKey);
	return path.join(characterSaveDirectory, `${characterKey}.json`);
}

function getCharacterHistoryPath(characterKey) {
	validateCharacterKey(characterKey);
	return path.join(characterHistoryDirectory, `${characterKey}.json`);
}

function getCreatureSavePath(entityKey) {
	validateEntityKey(entityKey);
	return path.join(creatureSaveDirectory, `${entityKey}.json`);
}

function getCreatureHistoryPath(entityKey) {
	validateEntityKey(entityKey);
	return path.join(creatureHistoryDirectory, `${entityKey}.json`);
}

function validateCharacterKey(characterKey) {
	try {
		validateEntityKey(characterKey);
	}
	catch (error) {
		error.code = 'INVALID_CHARACTER_NAME';
		error.message = 'Character keys must start and end with a letter or number and may '
			+ 'contain letters, numbers, periods, hyphens, and underscores.';
		throw error;
	}
}

function validateEntityKey(entityKey) {
	if (
		!entityKey
		|| !/^[\p{L}\p{N}](?:[\p{L}\p{N}_.-]{0,48}[\p{L}\p{N}])?$/u.test(
			entityKey,
		)
	) {
		const error = new Error(
			'Entity keys must start and end with a letter or number and may '
			+ 'contain letters, numbers, periods, hyphens, and underscores.',
		);
		error.code = 'INVALID_ENTITY_KEY';
		throw error;
	}
}

module.exports = {
	characterHistoryDirectory,
	characterSaveDirectory,
	creatureHistoryDirectory,
	creatureSaveDirectory,
	getCharacterHistoryPath,
	getCharacterSavePath,
	getCreatureHistoryPath,
	getCreatureSavePath,
	validateCharacterKey,
	validateEntityKey,
};

const fs = require('node:fs/promises');
const path = require('node:path');
const Character = require('../models/Character');

const savesDirectory = process.env.INCREDIBLE_BOT_SAVE_DIRECTORY
	? path.resolve(process.env.INCREDIBLE_BOT_SAVE_DIRECTORY)
	: path.join(__dirname, '..', 'save');

async function createCharacter(name, creatorId, initialize = () => undefined) {
	const character = new Character(name, creatorId);
	await initialize(character);
	character.key = name;
	await fs.mkdir(savesDirectory, { recursive: true });
	await fs.writeFile(getSavePath(name), JSON.stringify(character, null, 2), {
		encoding: 'utf8',
		flag: 'wx',
	});
	return character;
}

async function deleteCharacter(name, canManage) {
	const character = await getCharacter(name);
	if (!canManage(character)) {
		const error = new Error('Only the character creator can delete it.');
		error.code = 'NOT_CHARACTER_OWNER';
		throw error;
	}
	await fs.unlink(getSavePath(name));
}

async function updateCharacter(name, canManage, update) {
	const character = await getCharacter(name);
	if (!canManage(character)) {
		const error = new Error('Only the character creator or a DM can edit it.');
		error.code = 'NOT_CHARACTER_EDITOR';
		throw error;
	}

	await update(character);
	await saveCharacter(character, name);
	return character;
}

async function getCharacter(name) {
	const data = await fs.readFile(getSavePath(name), 'utf8');
	return Character.fromSave(JSON.parse(data), name);
}

async function listCharacters({ onLoadError = reportCharacterLoadError } = {}) {
	await fs.mkdir(savesDirectory, { recursive: true });
	const entries = await fs.readdir(savesDirectory, { withFileTypes: true });
	const characters = await Promise.all(entries
		.filter(entry => entry.isFile() && entry.name.endsWith('.json'))
		.map(async entry => {
			const key = entry.name.slice(0, -'.json'.length);
			try {
				return await getCharacter(key);
			}
			catch (error) {
				onLoadError(new CharacterLoadError(key, error));
				return null;
			}
		}));
	return characters
		.filter(Boolean)
		.sort((left, right) => left.key.localeCompare(right.key));
}

class CharacterLoadError extends Error {
	constructor(characterKey, cause) {
		super(`Could not load character save "${characterKey}": ${cause.message}`, { cause });
		this.name = 'CharacterLoadError';
		this.code = 'INVALID_CHARACTER_SAVE';
		this.characterKey = characterKey;
	}
}

function reportCharacterLoadError(error) {
	console.error(error);
}

async function saveCharacter(character, originalName = character.key) {
	await fs.mkdir(savesDirectory, { recursive: true });
	await fs.writeFile(
		getSavePath(originalName),
		JSON.stringify(character, null, 2),
		'utf8',
	);
}

function getSavePath(name) {
	if (
		!name
		|| !/^[\p{L}\p{N}](?:[\p{L}\p{N}_.-]{0,48}[\p{L}\p{N}])?$/u.test(name)
	) {
		const error = new Error(
			'Character keys must start and end with a letter or number and may '
			+ 'contain letters, numbers, periods, hyphens, and underscores.',
		);
		error.code = 'INVALID_CHARACTER_NAME';
		throw error;
	}
	return path.join(savesDirectory, `${name}.json`);
}

module.exports = {
	CharacterLoadError,
	createCharacter,
	deleteCharacter,
	getCharacter,
	listCharacters,
	updateCharacter,
};

const fs = require('node:fs/promises');
const path = require('node:path');
const Character = require('../models/Character');

const savesDirectory = path.join(__dirname, '..', 'save');

async function createCharacter(name, creatorId) {
	const character = new Character(name, creatorId);
	await fs.mkdir(savesDirectory, { recursive: true });
	await fs.writeFile(getSavePath(name), JSON.stringify(character, null, 2), {
		encoding: 'utf8',
		flag: 'wx',
	});
	return character;
}

async function deleteCharacter(name, requesterId) {
	const character = await getCharacter(name);
	if (character.creatorId !== requesterId) {
		const error = new Error('Only the character creator can delete it.');
		error.code = 'NOT_CHARACTER_OWNER';
		throw error;
	}
	await fs.unlink(getSavePath(name));
}

async function updateCharacter(name, requesterId, canManage, update) {
	const character = await getCharacter(name);
	if (character.creatorId !== requesterId && !canManage) {
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
	return Character.fromSave(JSON.parse(data));
}

async function saveCharacter(character, originalName = character.name) {
	await fs.mkdir(savesDirectory, { recursive: true });
	await fs.writeFile(
		getSavePath(originalName),
		JSON.stringify(character, null, 2),
		'utf8',
	);
}

function getSavePath(name) {
	if (!name || !/^[\p{L}\p{N}_-]{1,50}$/u.test(name)) {
		const error = new Error(
			'Character names may only contain letters, numbers, hyphens, and underscores.',
		);
		error.code = 'INVALID_CHARACTER_NAME';
		throw error;
	}
	return path.join(savesDirectory, `${name}.json`);
}

module.exports = {
	createCharacter,
	deleteCharacter,
	getCharacter,
	updateCharacter,
};

const fs = require('node:fs/promises');
const {
	getCharacterHistoryPath,
	getCharacterSavePath,
	getCreatureHistoryPath,
	getCreatureSavePath,
	validateEntityKey,
} = require('./characterStoragePaths');

async function assertEntityKeyAvailable(entityKey) {
	validateEntityKey(entityKey);
	const [
		characterExists,
		creatureExists,
		characterHistoryExists,
		creatureHistoryExists,
	] = await Promise.all([
		pathExists(getCharacterSavePath(entityKey)),
		pathExists(getCreatureSavePath(entityKey)),
		pathExists(getCharacterHistoryPath(entityKey)),
		pathExists(getCreatureHistoryPath(entityKey)),
	]);
	if (
		characterExists
		|| creatureExists
		|| characterHistoryExists
		|| creatureHistoryExists
	) {
		const error = new Error(`An entity named "${entityKey}" already exists.`);
		error.code = 'EEXIST';
		throw error;
	}
}

async function getStoredEntityTypes(entityKey) {
	validateEntityKey(entityKey);
	const [characterExists, creatureExists] = await Promise.all([
		pathExists(getCharacterSavePath(entityKey)),
		pathExists(getCreatureSavePath(entityKey)),
	]);
	return [
		...(characterExists ? ['character'] : []),
		...(creatureExists ? ['creature'] : []),
	];
}

async function pathExists(filePath) {
	try {
		await fs.access(filePath);
		return true;
	}
	catch (error) {
		if (error.code === 'ENOENT') {
			return false;
		}
		throw error;
	}
}

module.exports = {
	assertEntityKeyAvailable,
	getStoredEntityTypes,
	pathExists,
};

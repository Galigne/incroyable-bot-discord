const characterStore = require('./characterStore');
const { populateRandomCharacter } = require('./randomCharacterGenerator');

async function generateCharacter(characterKey, creatorId, options) {
	return characterStore.createCharacter(
		characterKey,
		creatorId,
		character => populateRandomCharacter(character, options),
	);
}

module.exports = {
	generateCharacter,
};

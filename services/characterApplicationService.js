const characterStore = require('./characterStore');
const { populateRandomCharacter } = require('./randomCharacterGenerator');

async function generateCharacter(characterKey, options) {
	return characterStore.createCharacter(
		characterKey,
		[],
		character => populateRandomCharacter(character, options),
	);
}

module.exports = {
	generateCharacter,
};

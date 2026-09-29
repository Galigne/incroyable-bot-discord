const characterStore = require('./characterStore');
const { createEntitySettings } = require('./entitySettings');
const { populateRandomCharacter } = require('./randomCharacterGenerator');

async function generateCharacter(characterKey, options) {
	return characterStore.createCharacter(
		characterKey,
		createEntitySettings('private'),
		character => populateRandomCharacter(character, options),
	);
}

module.exports = {
	generateCharacter,
};

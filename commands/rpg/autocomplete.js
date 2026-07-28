const {
	listCharacters,
} = require('../../services/characterApplicationService');
const { filterAutocompleteChoices } = require('../../util/autocomplete');

async function getCharacterChoices(focusedValue, options = {}) {
	const characters = await listCharacters();
	const filteredCharacters = options.creatorId
		? characters.filter(character => character.creatorId === options.creatorId)
		: characters;
	return filterAutocompleteChoices(
		filteredCharacters.map(character => ({
			name: character.displayName === character.key
				? character.key
				: `${character.displayName} (${character.key})`,
			value: character.key,
		})),
		focusedValue,
	);
}

module.exports = { getCharacterChoices };

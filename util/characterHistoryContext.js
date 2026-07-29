const { getCharacterHistoryMaxEntries } = require('./configuration');

function createCharacterHistoryContext(interaction, config) {
	return {
		actorId: interaction.user.id,
		maxEntries: getCharacterHistoryMaxEntries(config),
	};
}

module.exports = { createCharacterHistoryContext };

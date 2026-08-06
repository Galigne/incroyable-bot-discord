const { getCharacterHistoryMaxEntries } = require('./configuration');

function createEntityHistoryContext(interaction, config) {
	return {
		actorId: interaction.user.id,
		maxEntries: getCharacterHistoryMaxEntries(config),
	};
}

module.exports = { createEntityHistoryContext };

const { getEntityHistoryMaxEntries } = require('./configuration');

function createEntityHistoryContext(interaction, config) {
	return {
		actorId: interaction.user.id,
		maxEntries: getEntityHistoryMaxEntries(config),
	};
}

module.exports = { createEntityHistoryContext };

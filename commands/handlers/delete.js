const { openEntityDeletionConfirmation } = require('../character/interactions');

module.exports = {
	async execute({ config, interaction }) {
		await openEntityDeletionConfirmation(
			interaction,
			config,
			interaction.options.getString('entity-key', true),
		);
	},
};

const { openEntityEditor } = require('../entity/interactions');

module.exports = {
	async execute({ config, interaction }) {
		await openEntityEditor(
			interaction,
			config,
			interaction.options.getString('entity-key', true),
			interaction.options.getString('field', true),
		);
	},
};

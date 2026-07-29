const { openCharacterEditor } = require('../interactions');

module.exports = {
	async execute({ config, interaction }) {
		await openCharacterEditor(
			interaction,
			config,
			interaction.options.getString('character-key', true),
			interaction.options.getString('field', true),
		);
	},
};

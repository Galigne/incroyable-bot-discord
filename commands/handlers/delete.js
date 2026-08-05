const {
	openCharacterDeletionConfirmation,
} = require('../character/interactions');

module.exports = {
	async execute({ config, interaction }) {
		await openCharacterDeletionConfirmation(
			interaction,
			config,
			interaction.options.getString('character-key', true),
		);
	},
};

const { createHelpResponse } = require('../util/helpResponses');

module.exports = {
	async execute({ client, config, interaction, locale, registry }) {
		await interaction.reply(createHelpResponse({
			avatarUrl: client.user.displayAvatarURL(),
			commandName: interaction.options.getString('command'),
			config,
			interaction,
			locale,
			registry,
		}));
	},
};

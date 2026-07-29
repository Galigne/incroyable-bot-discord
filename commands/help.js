const { createCommandHelpResponse } = require('../util/helpResponses');
const { getLocale } = require('../util/i18n');

module.exports = {
	async execute({ client, config, interaction, registry }) {
		const locale = getLocale(config, interaction.guildId);
		await interaction.reply(createCommandHelpResponse(
			registry.getAllCommands().filter(metadata => !metadata.parent),
			client.user.displayAvatarURL(),
			locale,
		));
	},
};

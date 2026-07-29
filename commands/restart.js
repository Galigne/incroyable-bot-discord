const { getLocale, t } = require('../util/i18n');

module.exports = {
	async execute({ client, config, interaction, token }) {
		await interaction.reply(t(
			getLocale(config, interaction.guildId),
			'commands.restart.reply',
		));
		client.destroy();
		await client.login(token);
	},
};

const {
	InteractionContextType,
	SlashCommandBuilder,
} = require('discord.js');
const { getLocale, localizeDescription, t } = require('../util/i18n');

const descriptionKey = 'commands.restart.description';

module.exports = {
	name: 'restart',
	description: t('en', descriptionKey),
	descriptionKey,
	usage: '/restart',
	helpOrder: 70,
	access: {
		permission: 'moderator',
	},
	data: localizeDescription(new SlashCommandBuilder()
		.setName('restart')
		.setContexts(InteractionContextType.Guild), descriptionKey),
	async execute({ client, config, interaction, token }) {
		await interaction.reply(t(
			getLocale(config, interaction.guildId),
			'commands.restart.reply',
		));
		client.destroy();
		await client.login(token);
	},
};

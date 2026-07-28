const {
	InteractionContextType,
	SlashCommandBuilder,
} = require('discord.js');
const { createCommandHelpResponse } = require('../util/helpResponses');
const { getLocale, localizeDescription, t } = require('../util/i18n');

const descriptionKey = 'commands.help.description';

module.exports = {
	name: 'help',
	description: t('en', descriptionKey),
	descriptionKey,
	usage: '/help',
	helpOrder: 10,
	data: localizeDescription(new SlashCommandBuilder()
		.setName('help')
		.setContexts(InteractionContextType.Guild), descriptionKey),
	async execute({ client, config, interaction }) {
		const locale = getLocale(config, interaction.guildId);
		await interaction.reply(createCommandHelpResponse(
			client.commands.values(),
			client.user.displayAvatarURL(),
			locale,
		));
	},
};

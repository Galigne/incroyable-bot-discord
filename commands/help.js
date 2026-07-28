const {
	EmbedBuilder,
	InteractionContextType,
	SlashCommandBuilder,
} = require('discord.js');
const { sortByHelpOrder } = require('../util/sortByHelpOrder');
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
		const embed = new EmbedBuilder()
			.setTitle(t(locale, 'commands.help.title'))
			.setDescription(t(locale, 'commands.help.available'))
			.setColor('#FFD700')
			.setThumbnail(client.user.displayAvatarURL());

		for (const command of sortByHelpOrder(client.commands.values())) {
			embed.addFields({
				name: command.usage ?? `/${command.name}`,
				value: command.descriptionKey
					? t(locale, command.descriptionKey)
					: command.description,
			});
		}

		await interaction.reply({ embeds: [embed] });
	},
};

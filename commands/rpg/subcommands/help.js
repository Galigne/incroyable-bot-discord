const path = require('node:path');
const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { sortByHelpOrder } = require('../../../util/sortByHelpOrder');
const { getLocale, localizeDescription, t } = require('../../../util/i18n');

const descriptionKey = 'rpg.help.description';

module.exports = {
	name: 'help',
	description: t('en', descriptionKey),
	descriptionKey,
	usage: '/rpg help',
	helpOrder: 90,
	configure: command => localizeDescription(command.setName('help'), descriptionKey),
	async execute({ config, interaction }) {
		const locale = getLocale(config, interaction.guildId);
		const rpgCommand = interaction.client.commands.get('rpg');
		const embed = new EmbedBuilder()
			.setTitle(t(locale, 'rpg.help.title'))
			.setDescription(t(locale, 'rpg.help.body'))
			.setColor('#FFD700')
			.setThumbnail('attachment://logo.jpg');

		for (const subcommand of sortByHelpOrder(rpgCommand.subcommands.values())) {
			embed.addFields({
				name: subcommand.usage,
				value: subcommand.descriptionKey
					? t(locale, subcommand.descriptionKey)
					: subcommand.description,
			});
		}

		const logo = new AttachmentBuilder(
			path.join(__dirname, '..', '..', '..', 'media', 'LOGO.jpg'),
			{ name: 'logo.jpg' },
		);
		await interaction.reply({
			embeds: [embed],
			files: [logo],
		});
	},
};

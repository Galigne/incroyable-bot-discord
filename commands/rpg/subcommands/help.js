const path = require('node:path');
const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { sortByHelpOrder } = require('../../../util/sortByHelpOrder');

module.exports = {
	name: 'help',
	description: 'Show the available RPG commands',
	usage: '/rpg help',
	helpOrder: 90,
	configure: command => command
		.setName('help')
		.setDescription('Show the available RPG commands'),
	async execute({ interaction }) {
		const rpgCommand = interaction.client.commands.get('rpg');
		const embed = new EmbedBuilder()
			.setTitle('RPG Commands')
			.setDescription(
				'Create and manage RPG characters using a stable `CharacterKey` '
				+ '(for example, `D.Robert`). The key identifies the save and cannot be changed. '
				+ 'Use `/rpg set` with a field to open its prefilled private form. '
				+ 'Use the optional field in `/rpg get` for complete details.',
			)
			.setColor('#FFD700')
			.setThumbnail('attachment://logo.jpg');

		for (const subcommand of sortByHelpOrder(rpgCommand.subcommands.values())) {
			embed.addFields({
				name: subcommand.usage,
				value: subcommand.description,
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

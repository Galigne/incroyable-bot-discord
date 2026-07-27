const path = require('node:path');
const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { sortByHelpOrder } = require('../../../util/sortByHelpOrder');

module.exports = {
	name: 'help',
	description: 'Show the available RPG commands',
	usage: '!rpg help',
	helpOrder: 90,
	async execute({ message }) {
		const rpgCommand = message.client.commands.get('rpg');
		const embed = new EmbedBuilder()
			.setTitle('RPG Commands')
			.setDescription(
				'Create and manage RPG characters using a stable `CharacterKey` '
				+ '(for example, `D.Robert`). The key identifies the save and cannot be edited. '
				+ 'Use `!rpg editHelp` and `!rpg viewHelp` for character fields.',
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
		await message.channel.send({
			embeds: [embed],
			files: [logo],
		});
	},
};

const path = require('node:path');
const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { sortByHelpOrder } = require('../../../util/sortByHelpOrder');

module.exports = {
	name: 'help',
	description: 'Show the available JDR commands',
	usage: '!jdr help',
	helpOrder: 50,
	async execute({ message }) {
		const jdrCommand = message.client.commands.get('jdr');
		const embed = new EmbedBuilder()
			.setTitle('JDR Commands')
			.setDescription('Create and manage your JDR characters.')
			.setColor('#FFD700')
			.setThumbnail('attachment://logo.jpg');

		for (const subcommand of sortByHelpOrder(jdrCommand.subcommands.values())) {
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

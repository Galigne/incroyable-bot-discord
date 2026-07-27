const { EmbedBuilder } = require('discord.js');
const { sortByHelpOrder } = require('../util/sortByHelpOrder');

module.exports = {
	name: 'help',
	description: 'List all available commands',
	usage: '!help',
	helpOrder: 10,
	async execute({ client, message }) {
		const embed = new EmbedBuilder()
			.setTitle('Gon Freecss')
			.setDescription('Available commands')
			.setColor('#FFD700')
			.setThumbnail(client.user.displayAvatarURL());

		for (const command of sortByHelpOrder(client.commands.values())) {
			embed.addFields({
				name: command.usage ?? `!${command.name}`,
				value: command.description,
			});
		}

		await message.channel.send({ embeds: [embed] });
	},
};

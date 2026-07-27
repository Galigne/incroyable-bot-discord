const {
	EmbedBuilder,
	InteractionContextType,
	SlashCommandBuilder,
} = require('discord.js');
const { sortByHelpOrder } = require('../util/sortByHelpOrder');

module.exports = {
	name: 'help',
	description: 'List all available commands',
	usage: '/help',
	helpOrder: 10,
	data: new SlashCommandBuilder()
		.setName('help')
		.setDescription('List all available commands')
		.setContexts(InteractionContextType.Guild),
	async execute({ client, interaction }) {
		const embed = new EmbedBuilder()
			.setTitle('Gon Freecss')
			.setDescription('Available commands')
			.setColor('#FFD700')
			.setThumbnail(client.user.displayAvatarURL());

		for (const command of sortByHelpOrder(client.commands.values())) {
			embed.addFields({
				name: command.usage ?? `/${command.name}`,
				value: command.description,
			});
		}

		await interaction.reply({ embeds: [embed] });
	},
};

const {
	InteractionContextType,
	SlashCommandBuilder,
} = require('discord.js');

module.exports = {
	name: 'say',
	description: 'Send a message through the bot',
	usage: '/say message:<text>',
	helpOrder: 50,
	access: {
		role: 'moderator',
	},
	data: new SlashCommandBuilder()
		.setName('say')
		.setDescription('Send a message through the bot')
		.setContexts(InteractionContextType.Guild)
		.addStringOption(option => option
			.setName('message')
			.setDescription('Message to send')
			.setMaxLength(2_000)
			.setRequired(true)),
	async execute({ interaction }) {
		await interaction.reply(interaction.options.getString('message', true));
	},
};

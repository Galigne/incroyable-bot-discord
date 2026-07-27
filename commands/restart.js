const {
	InteractionContextType,
	SlashCommandBuilder,
} = require('discord.js');

module.exports = {
	name: 'restart',
	description: 'Reconnect the bot to Discord',
	usage: '/restart',
	helpOrder: 70,
	access: {
		role: 'moderator',
	},
	data: new SlashCommandBuilder()
		.setName('restart')
		.setDescription('Reconnect the bot to Discord')
		.setContexts(InteractionContextType.Guild),
	async execute({ client, interaction, token }) {
		await interaction.reply('Reconnecting...');
		client.destroy();
		await client.login(token);
	},
};

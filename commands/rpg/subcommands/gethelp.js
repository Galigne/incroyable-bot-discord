const { MessageFlags } = require('discord.js');
const { GET_HELP } = require('./get');

module.exports = {
	name: 'get-help',
	description: 'Explain character summary and detailed field views',
	usage: '/rpg get-help',
	helpOrder: 35,
	configure: command => command
		.setName('get-help')
		.setDescription('Explain character summary and detailed field views'),
	async execute({ interaction }) {
		await interaction.reply({
			content: GET_HELP,
			flags: MessageFlags.Ephemeral,
		});
	},
};

const { MessageFlags } = require('discord.js');
const { VIEW_HELP } = require('./view');

module.exports = {
	name: 'view-help',
	description: 'Explain character summary and detailed field views',
	usage: '/rpg view-help',
	helpOrder: 35,
	configure: command => command
		.setName('view-help')
		.setDescription('Explain character summary and detailed field views'),
	async execute({ interaction }) {
		await interaction.reply({
			content: VIEW_HELP,
			flags: MessageFlags.Ephemeral,
		});
	},
};

const { MessageFlags } = require('discord.js');
const { SET_HELP } = require('./set');

module.exports = {
	name: 'set-help',
	description: 'Explain settable character fields and forms',
	usage: '/rpg set-help',
	helpOrder: 45,
	configure: command => command
		.setName('set-help')
		.setDescription('Explain settable character fields and forms'),
	async execute({ interaction }) {
		await interaction.reply({
			content: SET_HELP,
			flags: MessageFlags.Ephemeral,
		});
	},
};

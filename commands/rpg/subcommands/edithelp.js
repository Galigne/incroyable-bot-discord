const { MessageFlags } = require('discord.js');
const { EDIT_HELP } = require('./edit');

module.exports = {
	name: 'edit-help',
	description: 'Explain editable character fields and forms',
	usage: '/rpg edit-help',
	helpOrder: 45,
	configure: command => command
		.setName('edit-help')
		.setDescription('Explain editable character fields and forms'),
	async execute({ interaction }) {
		await interaction.reply({
			content: EDIT_HELP,
			flags: MessageFlags.Ephemeral,
		});
	},
};

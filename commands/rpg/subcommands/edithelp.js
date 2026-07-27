const { EDIT_HELP } = require('./edit');

module.exports = {
	name: 'edit-help',
	description: 'Explain character fields and list editing',
	usage: '/rpg edit-help',
	helpOrder: 45,
	configure: command => command
		.setName('edit-help')
		.setDescription('Explain character fields and list editing'),
	async execute({ interaction }) {
		await interaction.reply({ content: EDIT_HELP, ephemeral: true });
	},
};

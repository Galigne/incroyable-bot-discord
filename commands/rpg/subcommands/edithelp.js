const { EDIT_HELP } = require('./edit');

module.exports = {
	name: 'edithelp',
	description: 'Explain character fields and list editing',
	usage: '!rpg editHelp',
	helpOrder: 45,
	async execute({ message }) {
		await message.reply(EDIT_HELP);
	},
};

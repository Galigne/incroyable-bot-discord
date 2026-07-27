const { VIEW_HELP } = require('./view');

module.exports = {
	name: 'viewhelp',
	description: 'Explain character summary and detailed field views',
	usage: '!rpg viewHelp',
	helpOrder: 35,
	async execute({ message }) {
		await message.reply(VIEW_HELP);
	},
};

const add = require('./subcommands/add');
const remove = require('./subcommands/delete');
const edit = require('./subcommands/edit');
const editHelp = require('./subcommands/edithelp');
const endTurn = require('./subcommands/endturn');
const generate = require('./subcommands/generate');
const help = require('./subcommands/help');
const rest = require('./subcommands/rest');
const rules = require('./subcommands/rules');
const view = require('./subcommands/view');
const viewHelp = require('./subcommands/viewhelp');
const { authorizeCommand } = require('../../util/authorization');

const subcommands = new Map([
	[add.name, add],
	[remove.name, remove],
	[edit.name, edit],
	[editHelp.name, editHelp],
	[endTurn.name, endTurn],
	[generate.name, generate],
	[help.name, help],
	[rest.name, rest],
	[rules.name, rules],
	[view.name, view],
	[viewHelp.name, viewHelp],
]);

module.exports = {
	name: 'rpg',
	description: 'Generate prompts and manage RPG character sheets',
	usage: '!rpg help',
	helpOrder: 30,
	subcommands,
	async execute(context) {
		const [requestedSubcommand, ...subcommandArgs] = context.args;
		if (!requestedSubcommand) {
			await context.message.reply('Use `!rpg help` to list the available RPG commands.');
			return;
		}

		const subcommand = subcommands.get(requestedSubcommand.toLowerCase());
		if (subcommand) {
			const authorization = authorizeCommand(subcommand, context.message, context.config);
			if (!authorization.allowed) {
				await context.message.reply(authorization.message);
				return;
			}
			await subcommand.execute({ ...context, args: subcommandArgs });
			return;
		}

		await context.message.reply(
			`Unknown RPG command: **${requestedSubcommand}**. `
			+ 'Use `!rpg help` to list the available RPG commands.',
		);
	},
};

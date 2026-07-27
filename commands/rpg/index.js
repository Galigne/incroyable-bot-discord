const add = require('./subcommands/add');
const remove = require('./subcommands/delete');
const generate = require('./subcommands/generate');
const help = require('./subcommands/help');
const rules = require('./subcommands/rules');
const view = require('./subcommands/view');
const { authorizeCommand } = require('../../util/authorization');

const subcommands = new Map([
	[add.name, add],
	[remove.name, remove],
	[generate.name, generate],
	[help.name, help],
	[rules.name, rules],
	[view.name, view],
]);

module.exports = {
	name: 'rpg',
	description: 'Create, view, and delete RPG characters',
	usage: '!rpg help',
	helpOrder: 30,
	subcommands,
	async execute(context) {
		const [requestedSubcommand, ...subcommandArgs] = context.args;
		if (!requestedSubcommand) {
			await help.execute({ ...context, args: [] });
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

		await view.execute({ ...context, args: context.args });
	},
};

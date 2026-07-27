const add = require('./subcommands/add');
const remove = require('./subcommands/delete');
const help = require('./subcommands/help');
const rules = require('./subcommands/rules');
const view = require('./subcommands/view');

const subcommands = new Map([
	[add.name, add],
	[remove.name, remove],
	[help.name, help],
	[rules.name, rules],
	[view.name, view],
]);

module.exports = {
	name: 'jdr',
	description: 'Create, view, and delete JDR characters',
	usage: '!jdr help',
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
			await subcommand.execute({ ...context, args: subcommandArgs });
			return;
		}

		await view.execute({ ...context, args: context.args });
	},
};

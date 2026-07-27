const {
	InteractionContextType,
	SlashCommandBuilder,
} = require('discord.js');
const add = require('./subcommands/add');
const remove = require('./subcommands/delete');
const edit = require('./subcommands/edit');
const editHelp = require('./subcommands/edithelp');
const endTurn = require('./subcommands/endturn');
const generate = require('./subcommands/generate');
const generateCharacter = require('./subcommands/generatecharacter');
const generateList = require('./subcommands/generatelist');
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
	[generateCharacter.name, generateCharacter],
	[generateList.name, generateList],
	[help.name, help],
	[rest.name, rest],
	[rules.name, rules],
	[view.name, view],
	[viewHelp.name, viewHelp],
]);

module.exports = {
	name: 'rpg',
	description: 'Generate prompts and manage RPG character sheets',
	usage: '/rpg',
	helpOrder: 30,
	data: new SlashCommandBuilder()
		.setName('rpg')
		.setDescription('Generate prompts and manage RPG character sheets')
		.setContexts(InteractionContextType.Guild)
		.addSubcommand(add.configure)
		.addSubcommand(remove.configure)
		.addSubcommand(edit.configure)
		.addSubcommand(editHelp.configure)
		.addSubcommand(endTurn.configure)
		.addSubcommand(generate.configure)
		.addSubcommand(generateCharacter.configure)
		.addSubcommand(generateList.configure)
		.addSubcommand(help.configure)
		.addSubcommand(rest.configure)
		.addSubcommand(rules.configure)
		.addSubcommand(view.configure)
		.addSubcommand(viewHelp.configure),
	subcommands,
	async execute(context) {
		const requestedSubcommand = context.interaction.options.getSubcommand();
		const subcommand = subcommands.get(requestedSubcommand);
		const authorization = authorizeCommand(
			subcommand,
			context.interaction,
			context.config,
		);
		if (!authorization.allowed) {
			await context.interaction.reply({
				content: authorization.message,
				ephemeral: true,
			});
			return;
		}
		await subcommand.execute(context);
	},
	async autocomplete(context) {
		const requestedSubcommand = context.interaction.options.getSubcommand();
		const subcommand = subcommands.get(requestedSubcommand);
		const authorization = authorizeCommand(
			subcommand,
			context.interaction,
			context.config,
		);
		if (!authorization.allowed || !subcommand?.autocomplete) {
			await context.interaction.respond([]);
			return;
		}
		await subcommand.autocomplete(context);
	},
};

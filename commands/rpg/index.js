const {
	InteractionContextType,
	MessageFlags,
	SlashCommandBuilder,
} = require('discord.js');
const add = require('./subcommands/add');
const damage = require('./subcommands/damage');
const remove = require('./subcommands/delete');
const set = require('./subcommands/set');
const setHelp = require('./subcommands/sethelp');
const endTurn = require('./subcommands/endturn');
const gen = require('./subcommands/gen');
const genChar = require('./subcommands/genchar');
const genHelp = require('./subcommands/genhelp');
const help = require('./subcommands/help');
const heal = require('./subcommands/heal');
const roll = require('./subcommands/roll');
const rules = require('./subcommands/rules');
const get = require('./subcommands/get');
const getHelp = require('./subcommands/gethelp');
const { authorizeCommand } = require('../../util/authorization');
const { localizeDescription, t } = require('../../util/i18n');

const descriptionKey = 'commands.rpg.description';

const subcommands = new Map([
	[add.name, add],
	[damage.name, damage],
	[remove.name, remove],
	[set.name, set],
	[setHelp.name, setHelp],
	[endTurn.name, endTurn],
	[gen.name, gen],
	[genChar.name, genChar],
	[genHelp.name, genHelp],
	[help.name, help],
	[heal.name, heal],
	[roll.name, roll],
	[rules.name, rules],
	[get.name, get],
	[getHelp.name, getHelp],
]);

module.exports = {
	name: 'rpg',
	description: t('en', descriptionKey),
	descriptionKey,
	usage: '/rpg',
	helpOrder: 30,
	data: localizeDescription(new SlashCommandBuilder()
		.setName('rpg')
		.setContexts(InteractionContextType.Guild), descriptionKey)
		.addSubcommand(add.configure)
		.addSubcommand(damage.configure)
		.addSubcommand(remove.configure)
		.addSubcommand(set.configure)
		.addSubcommand(setHelp.configure)
		.addSubcommand(endTurn.configure)
		.addSubcommand(gen.configure)
		.addSubcommand(genChar.configure)
		.addSubcommand(genHelp.configure)
		.addSubcommand(help.configure)
		.addSubcommand(heal.configure)
		.addSubcommand(roll.configure)
		.addSubcommand(rules.configure)
		.addSubcommand(get.configure)
		.addSubcommand(getHelp.configure),
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
				flags: MessageFlags.Ephemeral,
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

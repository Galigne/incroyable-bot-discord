const { filterAutocompleteChoices } = require('../../../util/autocomplete');
const { createDiceRollResponse } = require('../../../util/diceRollResponse');
const { getLocale, localizeDescription, t } = require('../../../util/i18n');

const COMMON_EXPRESSIONS = [
	'1d4',
	'1d6',
	'2d6',
	'1d8',
	'2d8',
	'1d10',
	'1d12',
	'1d20',
	'1d100',
	'4d6',
];
const descriptionKey = 'rpg.roll.description';

module.exports = {
	name: 'roll',
	description: t('en', descriptionKey),
	descriptionKey,
	usage: '/rpg roll expression:<dice expression>',
	helpOrder: 15,
	configure: command => localizeDescription(command.setName('roll'), descriptionKey)
		.addStringOption(option => localizeDescription(
			option.setName('expression'),
			'rpg.roll.expressionOption',
		)
			.setAutocomplete(true)
			.setRequired(true)),
	async autocomplete({ interaction }) {
		const focused = interaction.options.getFocused();
		const choices = filterAutocompleteChoices(
			COMMON_EXPRESSIONS.map(value => ({ name: value, value })),
			focused,
		);
		await interaction.respond(choices);
	},
	async execute({ config, interaction }) {
		const locale = getLocale(config, interaction.guildId);
		const expression = interaction.options.getString('expression', true);
		await interaction.reply(createDiceRollResponse(expression, locale));
	},
};

const path = require('node:path');
const { AttachmentBuilder } = require('discord.js');
const { filterAutocompleteChoices } = require('../../../util/autocomplete');
const { getLocale, localizeDescription, t } = require('../../../util/i18n');

const COMMON_DICE = [2, 4, 6, 8, 10, 12, 20, 100];
const descriptionKey = 'rpg.roll.description';

module.exports = {
	name: 'roll',
	description: t('en', descriptionKey),
	descriptionKey,
	usage: '/rpg roll sides:<2-1000>',
	helpOrder: 15,
	configure: command => localizeDescription(command.setName('roll'), descriptionKey)
		.addIntegerOption(option => localizeDescription(
			option.setName('sides'),
			'rpg.roll.sidesOption',
		)
			.setMinValue(2)
			.setMaxValue(1_000)
			.setAutocomplete(true)
			.setRequired(true)),
	async autocomplete({ interaction }) {
		const focused = interaction.options.getFocused();
		const choices = filterAutocompleteChoices(
			COMMON_DICE.map(value => ({ name: `D${value}`, value })),
			focused,
		);
		await interaction.respond(choices);
	},
	async execute({ config, interaction }) {
		const sides = interaction.options.getInteger('sides', true);
		const result = Math.floor(Math.random() * sides) + 1;

		if (sides === 2) {
			const coinSide = result === 1 ? 'HEADS' : 'TAILS';
			const animation = new AttachmentBuilder(
				path.join(__dirname, '..', '..', '..', 'media', `${coinSide}.gif`),
			);
			await interaction.reply({ files: [animation] });
			return;
		}
		if (sides === 20) {
			const animation = new AttachmentBuilder(
				path.join(__dirname, '..', '..', '..', 'media', `D20-${result}.gif`),
			);
			await interaction.reply({ files: [animation] });
			return;
		}

		await interaction.reply(t(
			getLocale(config, interaction.guildId),
			'rpg.roll.result',
			{ result },
		));
	},
};

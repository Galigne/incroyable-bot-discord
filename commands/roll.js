const path = require('node:path');
const {
	AttachmentBuilder,
	InteractionContextType,
	SlashCommandBuilder,
} = require('discord.js');
const { filterAutocompleteChoices } = require('../util/autocomplete');

const COMMON_DICE = [2, 4, 6, 8, 10, 12, 20, 100];

module.exports = {
	name: 'roll',
	description: 'Roll a die with a configurable number of sides',
	usage: '/roll sides:<2-1000>',
	helpOrder: 20,
	data: new SlashCommandBuilder()
		.setName('roll')
		.setDescription('Roll a die with a configurable number of sides')
		.setContexts(InteractionContextType.Guild)
		.addIntegerOption(option => option
			.setName('sides')
			.setDescription('Number of sides on the die')
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
	async execute({ interaction }) {
		const sides = interaction.options.getInteger('sides', true);

		const result = Math.floor(Math.random() * sides) + 1;
		if (sides === 2) {
			const coinSide = result === 1 ? 'HEADS' : 'TAILS';
			const animation = new AttachmentBuilder(
				path.join(__dirname, '..', 'media', `${coinSide}.gif`),
			);
			await interaction.reply({ files: [animation] });
			return;
		}
		if (sides === 20) {
			const animation = new AttachmentBuilder(
				path.join(__dirname, '..', 'media', `D20-${result}.gif`),
			);
			await interaction.reply({ files: [animation] });
			return;
		}

		await interaction.reply(`You rolled **${result}**.`);
	},
};

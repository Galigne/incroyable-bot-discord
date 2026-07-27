const characterStore = require('../../../services/characterStore');
const generatorCatalog = require('../../../services/generatorCatalog');
const { populateRandomCharacter } = require('../../../services/randomCharacterGenerator');
const { replyToCharacterError } = require('../../../util/characterCommandErrors');
const { filterAutocompleteChoices } = require('../../../util/autocomplete');

module.exports = {
	name: 'generate-character',
	description: 'Generate and save a complete random character (DM only)',
	usage: '/rpg generate-character character-key:<new key> [level] [background]',
	helpOrder: 11,
	access: {
		role: 'dm',
	},
	configure: command => command
		.setName('generate-character')
		.setDescription('Generate and save a complete random character')
		.addStringOption(option => option
			.setName('character-key')
			.setDescription('Unique save key, make it short and remember it.')
			.setMinLength(1)
			.setMaxLength(50)
			.setRequired(true))
		.addIntegerOption(option => option
			.setName('level')
			.setDescription('Character level; omitted means a random level from 1 to 10')
			.setMinValue(1)
			.setMaxValue(10)
			.setAutocomplete(true))
		.addStringOption(option => option
			.setName('background')
			.setDescription('NPC background category; omitted means a random background')
			.setAutocomplete(true)),
	async autocomplete({ interaction }) {
		const focused = interaction.options.getFocused(true);
		if (focused.name === 'level') {
			const levels = Array.from({ length: 10 }, (_, index) => index + 1);
			await interaction.respond(filterAutocompleteChoices(
				levels.map(level => ({ name: `Level ${level}`, value: level })),
				focused.value,
			));
			return;
		}
		const backgrounds = generatorCatalog.getCategory('background')?.entries ?? [];
		await interaction.respond(filterAutocompleteChoices(
			backgrounds.map(entry => ({
				name: `${entry.fields.Name} — ${entry.fields.Description}`.slice(0, 100),
				value: entry.fields.Name,
			})),
			focused.value,
		));
	},
	async execute({ interaction }) {
		const characterKey = interaction.options.getString('character-key', true);
		const level = interaction.options.getInteger('level');
		const background = interaction.options.getString('background');
		try {
			const character = await characterStore.createCharacter(
				characterKey,
				interaction.user.id,
				generatedCharacter => populateRandomCharacter(
					generatedCharacter,
					{ background, level },
				),
			);
			const embed = character.toEmbed()
				.setFooter({ text: `Character key: ${character.key}` });
			await interaction.reply({
				content: `Generated character **${character.displayName}** with key \`${character.key}\`.`,
				embeds: [embed],
			});
		}
		catch (error) {
			if (!await replyToCharacterError(interaction, error)) {
				throw error;
			}
		}
	},
};

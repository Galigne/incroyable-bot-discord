const characterStore = require('../../../services/characterStore');
const { populateRandomCharacter } = require('../../../services/randomCharacterGenerator');
const { replyToCharacterError } = require('../../../util/characterCommandErrors');
const { filterAutocompleteChoices } = require('../../../util/autocomplete');

module.exports = {
	name: 'generate-character',
	description: 'Generate and save a complete random character (DM only)',
	usage: '/rpg generate-character character-key:<new key> [level]',
	helpOrder: 11,
	access: {
		role: 'dm',
	},
	configure: command => command
		.setName('generate-character')
		.setDescription('Generate and save a complete random character')
		.addStringOption(option => option
			.setName('character-key')
			.setDescription('Unique save key, for example D.Robert')
			.setMinLength(1)
			.setMaxLength(50)
			.setRequired(true))
		.addIntegerOption(option => option
			.setName('level')
			.setDescription('Character level; omitted means a random level from 1 to 10')
			.setMinValue(1)
			.setMaxValue(10)
			.setAutocomplete(true)),
	async autocomplete({ interaction }) {
		const levels = Array.from({ length: 10 }, (_, index) => index + 1);
		await interaction.respond(filterAutocompleteChoices(
			levels.map(level => ({ name: `Level ${level}`, value: level })),
			interaction.options.getFocused(),
		));
	},
	async execute({ interaction }) {
		const characterKey = interaction.options.getString('character-key', true);
		const level = interaction.options.getInteger('level');
		try {
			const character = await characterStore.createCharacter(
				characterKey,
				interaction.user.id,
				generatedCharacter => populateRandomCharacter(generatedCharacter, { level }),
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

const characterStore = require('../../../services/characterStore');
const { restoreResource } = require('../../../services/mechanics/resources');
const { canManageCharacters } = require('../../../util/characterAuthorization');
const { replyToCharacterError } = require('../../../util/characterCommandErrors');
const { filterAutocompleteChoices } = require('../../../util/autocomplete');
const { getCharacterChoices } = require('../autocomplete');

const COMMON_HEAL_PERCENTAGES = [0, 25, 50, 75, 100];

module.exports = {
	name: 'heal',
	description: 'Restore current HP or AR to a percentage of its maximum',
	usage: '/rpg heal character-key:<key> resource:<HP|AR> percentage:<0-100>',
	helpOrder: 50,
	configure: command => command
		.setName('heal')
		.setDescription('Restore current HP or AR to a percentage of its maximum')
		.addStringOption(option => option
			.setName('character-key')
			.setDescription('Character receiving the healing')
			.setAutocomplete(true)
			.setRequired(true))
		.addStringOption(option => option
			.setName('resource')
			.setDescription('Resource to restore')
			.addChoices(
				{ name: 'HP', value: 'hp' },
				{ name: 'AR', value: 'ar' },
			)
			.setRequired(true))
		.addNumberOption(option => option
			.setName('percentage')
			.setDescription('Percentage of the maximum to restore to')
			.setMinValue(0)
			.setMaxValue(100)
			.setAutocomplete(true)
			.setRequired(true)),
	async autocomplete({ interaction }) {
		const focused = interaction.options.getFocused(true);
		if (focused.name === 'character-key') {
			await interaction.respond(await getCharacterChoices(focused.value));
			return;
		}
		await interaction.respond(filterAutocompleteChoices(
			COMMON_HEAL_PERCENTAGES.map(value => ({
				name: `${value}%`,
				value,
			})),
			focused.value,
		));
	},
	async execute({ config, interaction }) {
		const characterName = interaction.options.getString('character-key', true);
		const resource = interaction.options.getString('resource', true);
		const percentage = interaction.options.getNumber('percentage', true);
		try {
			const character = await characterStore.updateCharacter(
				characterName,
				interaction.user.id,
				canManageCharacters(interaction, config),
				currentCharacter => {
					restoreResource(currentCharacter, resource, percentage);
				},
			);
			const target = character.resources[resource];
			await interaction.reply(
				`**${character.displayName}** now has ${target.current}/${target.max} `
				+ `${resource.toUpperCase()} (${percentage}%).`,
			);
		}
		catch (error) {
			if (!await replyToCharacterError(interaction, error)) {
				throw error;
			}
		}
	},
};

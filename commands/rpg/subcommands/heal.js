const characterStore = require('../../../services/characterStore');
const { restoreHealingResources } = require('../../../services/mechanics/resources');
const { canManageCharacters } = require('../../../util/characterAuthorization');
const { replyToCharacterError } = require('../../../util/characterCommandErrors');
const { filterAutocompleteChoices } = require('../../../util/autocomplete');
const { getCharacterChoices } = require('../autocomplete');
const { getLocale, localizeDescription, t } = require('../../../util/i18n');
const {
	getResourceAbbreviation,
	getResourceChoiceLabel,
} = require('../../../util/characterDisplay');

const COMMON_HEAL_PERCENTAGES = [0, 25, 50, 75, 100];
const descriptionKey = 'rpg.heal.description';

module.exports = {
	name: 'heal',
	description: t('en', descriptionKey),
	descriptionKey,
	usage: '/rpg heal character-key:<key> resource:<hp|armor|both> percentage:<0-100>',
	helpOrder: 50,
	configure: command => localizeDescription(command.setName('heal'), descriptionKey)
		.addStringOption(option => localizeDescription(
			option.setName('character-key'),
			'rpg.heal.characterOption',
		)
			.setAutocomplete(true)
			.setRequired(true))
		.addStringOption(option => localizeDescription(
			option.setName('resource'),
			'rpg.heal.resourceOption',
		)
			.addChoices(
				{
					name: getResourceChoiceLabel('en', 'hp'),
					name_localizations: { fr: getResourceChoiceLabel('fr', 'hp') },
					value: 'hp',
				},
				{
					name: getResourceChoiceLabel('en', 'ar'),
					name_localizations: { fr: getResourceChoiceLabel('fr', 'ar') },
					value: 'armor',
				},
				{
					name: getBothResourceLabel('en'),
					name_localizations: { fr: getBothResourceLabel('fr') },
					value: 'both',
				},
			)
			.setRequired(true))
		.addNumberOption(option => localizeDescription(
			option.setName('percentage'),
			'rpg.heal.percentageOption',
		)
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
		const locale = getLocale(config, interaction.guildId);
		const characterName = interaction.options.getString('character-key', true);
		const resource = interaction.options.getString('resource', true);
		const percentage = interaction.options.getNumber('percentage', true);
		try {
			let restoredResources;
			const character = await characterStore.updateCharacter(
				characterName,
				interaction.user.id,
				canManageCharacters(interaction, config),
				currentCharacter => {
					restoredResources = restoreHealingResources(
						currentCharacter,
						resource,
						percentage,
						locale,
					);
				},
			);
			const changes = restoredResources.map(result => t(locale, 'rpg.heal.change', {
				current: result.current,
				max: result.max,
				previous: result.previous,
				resource: result.resource === 'hp'
					? getResourceAbbreviation(locale, 'hp')
					: getResourceAbbreviation(locale, 'ar'),
			}));
			await interaction.reply(t(locale, 'rpg.heal.result', {
				changes: changes.join('\n'),
				name: character.displayName,
				percentage,
			}));
		}
		catch (error) {
			if (!await replyToCharacterError(interaction, error, locale)) {
				throw error;
			}
		}
	},
};

function getBothResourceLabel(locale) {
	return t(locale, 'rpg.heal.both', {
		ar: getResourceAbbreviation(locale, 'ar'),
		hp: getResourceAbbreviation(locale, 'hp'),
	});
}

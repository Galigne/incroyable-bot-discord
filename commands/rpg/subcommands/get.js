const { MessageFlags } = require('discord.js');
const characterStore = require('../../../services/characterStore');
const { filterAutocompleteChoices } = require('../../../util/autocomplete');
const { getCharacterChoices } = require('../autocomplete');
const { getLocale, localizeDescription, t } = require('../../../util/i18n');
const { getCharacterFieldLabel } = require('../../../util/characterDisplay');

const GET_FIELDS = [
	'name',
	'firstName',
	'lastName',
	'level',
	'race',
	'appearance',
	'backstory',
	'goals',
	'personality',
	'racialTraits',
	'statistics',
	'rules',
	'talents',
	'status',
	'HP',
	'AR',
	'AP',
	'MD',
	'statusEffects',
	'equipment',
	'inventory',
	'encumbrance',
];

const descriptionKey = 'rpg.get.description';
const GET_HELP = t('en', 'rpg.getHelp.body');

module.exports = {
	name: 'get',
	description: t('en', descriptionKey),
	descriptionKey,
	usage: '/rpg get character-key:<key> [field]',
	helpOrder: 30,
	configure: command => localizeDescription(command.setName('get'), descriptionKey)
		.addStringOption(option => localizeDescription(
			option.setName('character-key'),
			'rpg.get.characterOption',
		)
			.setAutocomplete(true)
			.setRequired(true))
		.addStringOption(option => localizeDescription(
			option.setName('field'),
			'rpg.get.fieldOption',
		)
			.setAutocomplete(true)),
	async autocomplete({ config, interaction }) {
		const focused = interaction.options.getFocused(true);
		if (focused.name === 'character-key') {
			await interaction.respond(await getCharacterChoices(focused.value));
			return;
		}
		const locale = getLocale(config, interaction.guildId);
		await interaction.respond(filterAutocompleteChoices(
			GET_FIELDS.map(field => {
				const label = getGetFieldLabel(field, locale);
				return {
					name: (label === field ? label : `${label} (${field})`).slice(0, 100),
					value: field,
				};
			}),
			focused.value,
		));
	},
	async execute({ config, interaction }) {
		const locale = getLocale(config, interaction.guildId);
		const name = interaction.options.getString('character-key', true);
		const fieldName = interaction.options.getString('field');
		try {
			const character = await characterStore.getCharacter(name);
			const embed = fieldName
				? character.toFieldEmbed(fieldName, locale)
				: character.toEmbed(locale);
			if (!embed) {
				await interaction.reply({
					content: t(locale, 'rpg.get.unknownField', { field: fieldName }),
					flags: MessageFlags.Ephemeral,
				});
				return;
			}
			embed.setFooter({
				text: fieldName
					? t(locale, 'rpg.get.keyFooter', {
						key: name,
						keyLabel: getCharacterFieldLabel(locale, 'key'),
					})
					: t(locale, 'rpg.get.detailsFooter'),
			});
			await interaction.reply({ embeds: [embed] });
		}
		catch (error) {
			if (error.code === 'ENOENT') {
				await interaction.reply({
					content: t(locale, 'errors.characterMissing'),
					flags: MessageFlags.Ephemeral,
				});
				return;
			}
			if (error.code === 'INVALID_CHARACTER_NAME') {
				await interaction.reply({
					content: t(locale, 'errors.invalidCharacterKey'),
					flags: MessageFlags.Ephemeral,
				});
				return;
			}
			throw error;
		}
	},
};

module.exports.GET_FIELDS = GET_FIELDS;
module.exports.GET_HELP = GET_HELP;

function getGetFieldLabel(field, locale) {
	return getCharacterFieldLabel(locale, field, {
		abbreviated: ['HP', 'AR', 'AP', 'MD'].includes(field),
	});
}

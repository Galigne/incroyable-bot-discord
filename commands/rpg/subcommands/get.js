const {
	getCharacter,
} = require('../../../services/characterApplicationService');
const { filterAutocompleteChoices } = require('../../../util/autocomplete');
const { getCharacterChoices } = require('../autocomplete');
const { getLocale, localizeDescription, t } = require('../../../util/i18n');
const { getCharacterFieldLabel } = require('../../../util/characterDisplay');
const {
	createCharacterGetResponse,
} = require('../../../util/characterCommandResponses');
const { replyToCharacterError } = require('../../../util/characterCommandErrors');
const {
	getViewableFields,
} = require('../../../services/characterFieldCatalog');

const GET_FIELDS = getViewableFields().map(definition => definition.viewId);

const descriptionKey = 'rpg.get.description';

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
			const character = await getCharacter(name);
			await interaction.reply(
				createCharacterGetResponse(character, name, fieldName, locale),
			);
		}
		catch (error) {
			if (!await replyToCharacterError(interaction, error, locale)) {
				throw error;
			}
		}
	},
};

module.exports.GET_FIELDS = GET_FIELDS;

function getGetFieldLabel(field, locale) {
	return getCharacterFieldLabel(locale, field, {
		abbreviated: ['HP', 'AR', 'AP', 'MD'].includes(field),
	});
}

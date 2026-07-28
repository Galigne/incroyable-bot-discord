const { getCharacterChoices } = require('../autocomplete');
const { openCharacterEditor } = require('../interactions');
const { EDIT_FIELDS } = require('../editorFields');
const { filterAutocompleteChoices } = require('../../../util/autocomplete');
const { getLocale, localizeDescription, t } = require('../../../util/i18n');
const { getEditFieldLabel } = require('../editorFields');

const descriptionKey = 'rpg.set.description';

module.exports = {
	name: 'set',
	description: t('en', descriptionKey),
	descriptionKey,
	usage: '/rpg set character-key:<key> field:<field>',
	helpOrder: 40,
	configure: command => localizeDescription(command.setName('set'), descriptionKey)
		.addStringOption(option => localizeDescription(
			option.setName('character-key'),
			'rpg.set.characterOption',
		)
			.setAutocomplete(true)
			.setRequired(true))
		.addStringOption(option => localizeDescription(
			option.setName('field'),
			'rpg.set.fieldOption',
		)
			.setAutocomplete(true)
			.setRequired(true)),
	async autocomplete({ config, interaction }) {
		const focused = interaction.options.getFocused(true);
		if (focused.name === 'character-key') {
			await interaction.respond(await getCharacterChoices(focused.value));
			return;
		}
		const locale = getLocale(config, interaction.guildId);
		await interaction.respond(filterAutocompleteChoices(
			EDIT_FIELDS.map(field => ({
				name: `${getEditFieldLabel(field, locale)} (${field})`.slice(0, 100),
				value: field,
			})),
			focused.value,
		));
	},
	async execute({ config, interaction }) {
		await openCharacterEditor(
			interaction,
			config,
			interaction.options.getString('character-key', true),
			interaction.options.getString('field', true),
		);
	},
};

module.exports.EDIT_FIELDS = EDIT_FIELDS;

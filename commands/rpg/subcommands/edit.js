const { getCharacterChoices } = require('../autocomplete');
const { openCharacterEditor } = require('../interactions');
const { EDIT_FIELDS } = require('../editorFields');
const { filterAutocompleteChoices } = require('../../../util/autocomplete');

const EDIT_HELP = [
	'Use `/rpg edit character-key:<key> field:<field>` to open a private prefilled form.',
	'The CharacterKey identifies the save and cannot be edited.',
	'Nested fields use a dot, such as `race.name`, `stats.strength`, or `hp.current`.',
	'Text fields can be cleared by emptying the form before submitting it.',
	'',
	'**Identity and story**',
	'`firstName`, `lastName`, `level`, `backstory`, `goals`, `talents`',
	'`race.name`, `race.description`, `race.lore`',
	'`personality.description`, `personality.traits`',
	'`racialTrait.skillBonus`, `racialTrait.physicalAbility`',
	'',
	'**Statistics**',
	'`stats.constitution`, `stats.strength`, `stats.dexterity`, `stats.intelligence`',
	'`stats.speed`, `stats.perception`, `stats.charisma`, `stats.initiative`, `stats.reflexes`',
	'',
	'**Status and resources**',
	'`hp.current`, `hp.max`, `ar.current`, `ar.max`, `ap.current`, `ap.max`',
	'`md.current`, `md.max`, `encumbrance.current`, `encumbrance.max`',
	'AP values must be whole numbers with `0 ≤ current ≤ max ≤ 10`.',
	'',
	'**Multiline fields**',
	'`personality.traits`, `rules`, `statusEffects`, `equipment`, `inventory`',
	'Write one entry per line. Leading dashes are optional.',
	'For RULEs, use `Name: Description`, one RULE per line.',
	'',
	'**Examples**',
	'`/rpg edit character-key:D.Robert field:stats.strength`',
	'`/rpg edit character-key:D.Robert field:rules`',
].join('\n');

module.exports = {
	name: 'edit',
	description: 'Edit one character-sheet field in a prefilled form',
	usage: '/rpg edit character-key:<key> field:<field>',
	helpOrder: 40,
	configure: command => command
		.setName('edit')
		.setDescription('Edit one character-sheet field in a prefilled form')
		.addStringOption(option => option
			.setName('character-key')
			.setDescription('Character to edit')
			.setAutocomplete(true)
			.setRequired(true))
		.addStringOption(option => option
			.setName('field')
			.setDescription('Field to edit')
			.setAutocomplete(true)
			.setRequired(true)),
	async autocomplete({ interaction }) {
		const focused = interaction.options.getFocused(true);
		if (focused.name === 'character-key') {
			await interaction.respond(await getCharacterChoices(focused.value));
			return;
		}
		await interaction.respond(filterAutocompleteChoices(
			EDIT_FIELDS.map(field => ({ name: field, value: field })),
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

module.exports.EDIT_HELP = EDIT_HELP;
module.exports.EDIT_FIELDS = EDIT_FIELDS;

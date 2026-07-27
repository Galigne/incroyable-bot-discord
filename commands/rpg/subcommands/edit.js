const { editCharacter } = require('../../../services/characterEditor');
const characterStore = require('../../../services/characterStore');
const { canManageCharacters } = require('../../../util/characterAuthorization');
const { replyToCharacterError } = require('../../../util/characterCommandErrors');
const { filterAutocompleteChoices } = require('../../../util/autocomplete');
const { getCharacterChoices } = require('../autocomplete');

const EDIT_FIELDS = [
	'firstName',
	'lastName',
	'level',
	'race.name',
	'race.description',
	'race.lore',
	'backstory',
	'goals',
	'personality.description',
	'personality.traits',
	'racialTrait.skillBonus',
	'racialTrait.physicalAbility',
	'stats.constitution',
	'stats.strength',
	'stats.dexterity',
	'stats.intelligence',
	'stats.speed',
	'stats.perception',
	'stats.charisma',
	'stats.initiative',
	'stats.reflexes',
	'hp.current',
	'hp.max',
	'ar.current',
	'ar.max',
	'ap.current',
	'ap.max',
	'md.current',
	'md.max',
	'encumbrance.current',
	'encumbrance.max',
	'rules',
	'statusEffects',
	'equipment',
	'inventory',
];
const LIST_FIELDS = new Set([
	'personality.traits',
	'rules',
	'statusEffects',
	'equipment',
	'inventory',
].map(field => field.toLowerCase()));

const EDIT_HELP = [
	'Use `/rpg edit` to change one part of a sheet.',
	'The CharacterKey identifies the save and cannot be edited.',
	'Fields inside another field use a dot: `race.name`, `stats.strength`, or `hp.current`.',
	'Use `clear` as the value to empty a text field.',
	'',
	'**Text and number fields**',
	'`firstName`, `lastName`, `level`, `backstory`, `goals`, `talents`',
	'`race.name`, `race.description`, `race.lore`',
	'`personality.description`',
	'`racialTrait.skillBonus`, `racialTrait.physicalAbility`',
	'`stats.constitution`, `stats.strength`, `stats.dexterity`, `stats.intelligence`,',
	'`stats.speed`, `stats.perception`, `stats.charisma`, `stats.initiative`, `stats.reflexes`',
	'`hp.current`, `hp.max`, `ar.current`, `ar.max`, `ap.current`, `ap.max`,',
	'`md.current`, `md.max`, `encumbrance.current`, `encumbrance.max`',
	'AP values must be whole numbers with `0 ≤ current ≤ max ≤ 10`.',
	'',
	'**List fields**',
	'`personality.traits`, `rules`, `statusEffects`, `equipment`, `inventory`',
	'',
	'List actions:',
	'`add <value>` — append an item',
	'`set <position> <value>` — replace an item using its number in the displayed list',
	'`remove <position>` — remove one item',
	'`clear` — remove every item',
	'',
	'**Examples**',
	'Select `D.Robert`, `firstName`, then enter `Diego`.',
	'Select `D.Robert`, `stats.strength`, then enter `14`.',
	'For a list, enter `add Brave`, `set 1 Fearless`, `remove 1`, or `clear`.',
	'For a RULE, enter `add Fire | Controls nearby flames`.',
].join('\n');

module.exports = {
	name: 'edit',
	description: 'Edit one field of a character sheet',
	usage: '/rpg edit character-key:<key> field:<field> value:<value>',
	helpOrder: 40,
	configure: command => command
		.setName('edit')
		.setDescription('Edit one field of a character sheet')
		.addStringOption(option => option
			.setName('character-key')
			.setDescription('Character to edit')
			.setAutocomplete(true)
			.setRequired(true))
		.addStringOption(option => option
			.setName('field')
			.setDescription('Character field to edit')
			.setAutocomplete(true)
			.setRequired(true))
		.addStringOption(option => option
			.setName('value')
			.setDescription('New value, or a list operation such as add, set, remove, or clear')
			.setMaxLength(2_000)
			.setAutocomplete(true)
			.setRequired(true)),
	async autocomplete({ interaction }) {
		const focused = interaction.options.getFocused(true);
		if (focused.name === 'character-key') {
			await interaction.respond(await getCharacterChoices(focused.value));
			return;
		}
		if (focused.name === 'field') {
			await interaction.respond(filterAutocompleteChoices(
				EDIT_FIELDS.map(field => ({ name: field, value: field })),
				focused.value,
			));
			return;
		}
		const selectedField = interaction.options.getString('field')?.toLowerCase();
		const suggestions = LIST_FIELDS.has(selectedField)
			? ['add ', 'set 1 ', 'remove 1', 'clear']
			: ['clear'];
		await interaction.respond(filterAutocompleteChoices(
			suggestions.map(value => ({ name: value, value })),
			focused.value,
		));
	},
	async execute({ config, interaction }) {
		const characterName = interaction.options.getString('character-key', true);
		const fieldName = interaction.options.getString('field', true);
		const fieldArgs = interaction.options.getString('value', true).match(/\S+/g) ?? [];

		try {
			let editResult;
			const character = await characterStore.updateCharacter(
				characterName,
				interaction.user.id,
				canManageCharacters(interaction, config),
				currentCharacter => {
					editResult = editCharacter(currentCharacter, fieldName, fieldArgs);
				},
			);
			await interaction.reply(`Character **${character.displayName}**: ${editResult}`);
		}
		catch (error) {
			if (!await replyToCharacterError(interaction, error)) {
				throw error;
			}
		}
	},
};

module.exports.EDIT_HELP = EDIT_HELP;
module.exports.EDIT_FIELDS = EDIT_FIELDS;

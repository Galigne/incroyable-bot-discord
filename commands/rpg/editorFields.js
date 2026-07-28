const { getCharacterFieldLabel } = require('../../util/characterDisplay');

const EDIT_FIELDS = [
	'firstName',
	'lastName',
	'level',
	'race.name',
	'race.description',
	'race.lore',
	'appearance',
	'backstory',
	'goals',
	'personality.description',
	'personality.traits',
	'racialTrait.skillBonus',
	'racialTrait.physicalAbility',
	'talents',
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
const MULTILINE_COLLECTION_FIELDS = new Set([
	'personality.traits',
	'rules',
	'statusEffects',
	'equipment',
	'inventory',
].map(field => field.toLowerCase()));
const PARAGRAPH_FIELDS = new Set([
	'race.description',
	'race.lore',
	'appearance',
	'backstory',
	'goals',
	'personality.description',
	'personality.traits',
	'racialTrait.skillBonus',
	'racialTrait.physicalAbility',
	'talents',
	'rules',
	'statusEffects',
	'equipment',
	'inventory',
].map(field => field.toLowerCase()));

function getEditFieldLabel(fieldName, locale = 'en') {
	return getCharacterFieldLabel(locale, fieldName);
}

module.exports = {
	EDIT_FIELDS,
	getEditFieldLabel,
	MULTILINE_COLLECTION_FIELDS,
	PARAGRAPH_FIELDS,
};

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

function getEditFieldLabel(fieldName) {
	const labels = {
		firstName: 'First Name',
		lastName: 'Last Name',
		'race.name': 'Race Name',
		statusEffects: 'Status Effects',
		'race.description': 'Race Physical Description',
		'race.lore': 'Race Lore',
		'personality.description': 'Personality Description',
		'personality.traits': 'Personality Traits',
		'racialTrait.skillBonus': 'Racial Skill Bonus',
		'racialTrait.physicalAbility': 'Racial Physical Ability',
		'encumbrance.current': 'Current Encumbrance',
		'encumbrance.max': 'Maximum Encumbrance',
		rules: 'RULEs',
	};
	if (labels[fieldName]) {
		return labels[fieldName];
	}
	if (fieldName.startsWith('stats.')) {
		return capitalize(fieldName.split('.')[1]);
	}
	const resourceMatch = /^(hp|ar|ap|md)\.(current|max)$/i.exec(fieldName);
	if (resourceMatch) {
		return `${resourceMatch[2] === 'max' ? 'Maximum' : 'Current'} `
			+ resourceMatch[1].toUpperCase();
	}
	return fieldName
		.split('.')
		.reverse()
		.map(part => part.toUpperCase() === part
			? part
			: `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
		.join(' ');
}

function capitalize(value) {
	return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

module.exports = {
	EDIT_FIELDS,
	getEditFieldLabel,
	MULTILINE_COLLECTION_FIELDS,
	PARAGRAPH_FIELDS,
};

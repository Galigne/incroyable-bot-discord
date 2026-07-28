const { t } = require('./i18n');

// Abbreviation convention:
// English preserves the established internal-facing UI terms HP/AR/AP/MD.
// French follows JDR_RANDOM_RULES_FR.md: PV/PR/PA/DD. Each resource has a
// distinct abbreviation; identifiers and persisted paths remain English.
const RESOURCE_IDS = ['hp', 'ar', 'ap', 'md'];

const CHARACTER_DISPLAY_FIELDS = {
	key: field('characterKey'),
	name: field('name'),
	firstName: field('firstName'),
	lastName: field('lastName'),
	level: field('level'),
	race: field('race'),
	'race.name': field('raceName'),
	'race.physicalDescription': field('racePhysicalDescription'),
	'race.lore': field('raceLore'),
	appearance: field('appearance'),
	backstory: field('backstory'),
	goals: field('goals'),
	personality: field('personality'),
	'personality.description': field('personalityDescription'),
	'personality.traits': field('personalityTraits'),
	racialTraits: field('racialTraits'),
	'racialTraits.skillBonus': field('racialSkillBonus'),
	'racialTraits.physicalAbility': field('racialPhysicalAbility'),
	statistics: field('statistics'),
	'statistics.base': field('baseStatistics'),
	'statistics.derived': field('derivedStatistics'),
	'stats.constitution': field('constitution'),
	'stats.strength': field('strength'),
	'stats.dexterity': field('dexterity'),
	'stats.intelligence': field('intelligence'),
	'stats.speed': field('speed'),
	'stats.perception': field('perception'),
	'stats.charisma': field('charisma'),
	'stats.initiative': field('initiative'),
	'stats.reflexes': field('reflexes'),
	rules: field('rules'),
	'rules.name': field('ruleName'),
	'rules.level': field('ruleLevel'),
	'rules.description': field('ruleDescription'),
	talents: field('talents'),
	status: field('status'),
	statusEffects: field('statusEffects'),
	equipment: field('equipment'),
	inventory: field('inventory'),
	encumbrance: field('encumbrance'),
	'encumbrance.current': field('currentEncumbrance'),
	'encumbrance.max': field('maximumEncumbrance'),
};

for (const resourceId of RESOURCE_IDS) {
	CHARACTER_DISPLAY_FIELDS[`resources.${resourceId}`] = {
		abbreviationKey: `character.resources.${resourceId}.abbreviation`,
		labelKey: `character.resources.${resourceId}.name`,
		resourceId,
	};
	CHARACTER_DISPLAY_FIELDS[`resources.${resourceId}.current`] = {
		labelKey: 'character.fields.currentResource',
		resourceId,
	};
	CHARACTER_DISPLAY_FIELDS[`resources.${resourceId}.max`] = {
		labelKey: 'character.fields.maximumResource',
		resourceId,
	};
}

const CHARACTER_FIELD_ALIASES = {
	characterKey: 'key',
	firstname: 'firstName',
	lastname: 'lastName',
	'race.description': 'race.physicalDescription',
	'personalitytraits': 'personality.traits',
	'racialtrait.skillbonus': 'racialTraits.skillBonus',
	'racialtraits.skillbonus': 'racialTraits.skillBonus',
	'racialtrait.physicalability': 'racialTraits.physicalAbility',
	'racialtraits.physicalability': 'racialTraits.physicalAbility',
	racialtraits: 'racialTraits',
	baseStatistics: 'statistics.base',
	derivedStatistics: 'statistics.derived',
};

for (const resourceId of RESOURCE_IDS) {
	CHARACTER_FIELD_ALIASES[resourceId] = `resources.${resourceId}`;
	CHARACTER_FIELD_ALIASES[resourceId.toUpperCase()] = `resources.${resourceId}`;
	CHARACTER_FIELD_ALIASES[`${resourceId}.current`] = `resources.${resourceId}.current`;
	CHARACTER_FIELD_ALIASES[`${resourceId}.max`] = `resources.${resourceId}.max`;
}

function field(labelName) {
	return { labelKey: `character.fields.${labelName}` };
}

function resolveCharacterFieldId(fieldId) {
	return CHARACTER_FIELD_ALIASES[fieldId]
		?? CHARACTER_FIELD_ALIASES[fieldId.toLowerCase()]
		?? fieldId;
}

function getCharacterFieldDefinition(fieldId) {
	return CHARACTER_DISPLAY_FIELDS[resolveCharacterFieldId(fieldId)];
}

function getCharacterFieldLabel(locale, fieldId, options = {}) {
	const definition = getCharacterFieldDefinition(fieldId);
	if (!definition) {
		return null;
	}
	if (options.abbreviated && definition.abbreviationKey) {
		return t(locale, definition.abbreviationKey);
	}
	if (definition.resourceId && !definition.abbreviationKey) {
		return t(locale, definition.labelKey, {
			resource: getResourceAbbreviation(locale, definition.resourceId),
		});
	}
	return t(locale, definition.labelKey);
}

function getResourceName(locale, resourceId) {
	return t(locale, `character.resources.${resourceId}.name`);
}

function getResourceAbbreviation(locale, resourceId) {
	return t(locale, `character.resources.${resourceId}.abbreviation`);
}

function getResourceChoiceLabel(locale, resourceId) {
	return `${getResourceAbbreviation(locale, resourceId)} — ${getResourceName(locale, resourceId)}`;
}

module.exports = {
	CHARACTER_DISPLAY_FIELDS,
	CHARACTER_FIELD_ALIASES,
	RESOURCE_IDS,
	getCharacterFieldDefinition,
	getCharacterFieldLabel,
	getResourceAbbreviation,
	getResourceChoiceLabel,
	getResourceName,
	resolveCharacterFieldId,
};

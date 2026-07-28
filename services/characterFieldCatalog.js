const { BASE_STATS, DERIVED_STATS } = require('./mechanics/constants');

const definitions = [];
const definitionsById = new Map();
const aliases = new Map();

add('key', 'characterKey');
add('name', 'name', { viewId: 'name' });
add('firstName', 'firstName', editable('firstName', ['firstName'], 'text', {
	aliases: ['firstname'],
	viewId: 'firstName',
}));
add('lastName', 'lastName', editable('lastName', ['lastName'], 'text', {
	aliases: ['lastname'],
	viewId: 'lastName',
}));
add('level', 'level', editable('level', ['level'], 'number', { viewId: 'level' }));
add('race', 'race', { viewId: 'race' });
add('race.name', 'raceName', editable('race.name', ['race', 'name'], 'text', {
	aliases: ['racename'],
}));
add('race.physicalDescription', 'racePhysicalDescription', editable(
	'race.description',
	['race', 'physicalDescription'],
	'text',
	{
		aliases: ['race.description', 'racedescription'],
		paragraph: true,
	},
));
add('race.lore', 'raceLore', editable('race.lore', ['race', 'lore'], 'text', {
	aliases: ['racelore'],
	paragraph: true,
}));
add('appearance', 'appearance', editable('appearance', ['appearance'], 'text', {
	paragraph: true,
	viewId: 'appearance',
}));
add('backstory', 'backstory', editable('backstory', ['backstory'], 'text', {
	paragraph: true,
	viewId: 'backstory',
}));
add('goals', 'goals', editable('goals', ['goals'], 'text', {
	paragraph: true,
	viewId: 'goals',
}));
add('personality', 'personality', { viewId: 'personality' });
add('personality.description', 'personalityDescription', editable(
	'personality.description',
	['personality', 'description'],
	'text',
	{ aliases: ['personalitydescription'], paragraph: true },
));
add('personality.traits', 'personalityTraits', editable(
	'personality.traits',
	['personality', 'traits'],
	'text',
	{ aliases: ['personalitytraits'], multiline: true, paragraph: true },
));
add('racialTraits', 'racialTraits', {
	aliases: ['racialtraits'],
	viewId: 'racialTraits',
});
add('racialTraits.skillBonus', 'racialSkillBonus', editable(
	'racialTrait.skillBonus',
	['racialTraits', 'skillBonus'],
	'text',
	{
		aliases: ['racialtrait.skillbonus', 'racialtraits.skillbonus'],
		paragraph: true,
	},
));
add('racialTraits.physicalAbility', 'racialPhysicalAbility', editable(
	'racialTrait.physicalAbility',
	['racialTraits', 'physicalAbility'],
	'text',
	{
		aliases: ['racialtrait.physicalability', 'racialtraits.physicalability'],
		paragraph: true,
	},
));
add('statistics', 'statistics', { aliases: ['stats'], viewId: 'statistics' });
add('statistics.base', 'baseStatistics', { aliases: ['baseStatistics'] });
add('statistics.derived', 'derivedStatistics', { aliases: ['derivedStatistics'] });

for (const stat of [...BASE_STATS, ...DERIVED_STATS]) {
	add(`stats.${stat}`, stat, editable(
		`stats.${stat}`,
		['stats', stat],
		'number',
		{ aliases: [stat] },
	));
}

add('rules', 'rules', editable('rules', ['rules'], 'text', {
	aliases: ['rule'],
	multiline: true,
	paragraph: true,
	rules: true,
	viewId: 'rules',
}));
add('rules.name', 'ruleName');
add('rules.level', 'ruleLevel');
add('rules.description', 'ruleDescription');
add('talents', 'talents', editable('talents', ['talents'], 'text', {
	paragraph: true,
	viewId: 'talents',
}));
add('status', 'status', { viewId: 'status' });
add('statusEffects', 'statusEffects', editable(
	'statusEffects',
	['statusEffects'],
	'text',
	{
		aliases: ['statuseffect', 'statuseffects'],
		multiline: true,
		paragraph: true,
		viewId: 'statusEffects',
	},
));
add('equipment', 'equipment', editable('equipment', ['equipment'], 'text', {
	multiline: true,
	paragraph: true,
	viewId: 'equipment',
}));
add('inventory', 'inventory', editable('inventory', ['inventory'], 'text', {
	multiline: true,
	paragraph: true,
	viewId: 'inventory',
}));
add('encumbrance', 'encumbrance', { viewId: 'encumbrance' });
add('encumbrance.current', 'currentEncumbrance', editable(
	'encumbrance.current',
	['encumbrance', 'current'],
	'number',
	{ aliases: ['encumbrancecapacity.current'] },
));
add('encumbrance.max', 'maximumEncumbrance', editable(
	'encumbrance.max',
	['encumbrance', 'max'],
	'number',
	{ aliases: ['encumbrancecapacity.max'] },
));

for (const resourceId of ['hp', 'ar', 'ap', 'md']) {
	add(`resources.${resourceId}`, null, {
		abbreviationKey: `character.resources.${resourceId}.abbreviation`,
		aliases: [resourceId, resourceId.toUpperCase()],
		labelKey: `character.resources.${resourceId}.name`,
		resourceId,
		viewId: resourceId.toUpperCase(),
	});
	for (const value of ['current', 'max']) {
		add(
			`resources.${resourceId}.${value}`,
			value === 'current' ? 'currentResource' : 'maximumResource',
			editable(
				`${resourceId}.${value}`,
				['resources', resourceId, value],
				'number',
				{
					aliases: [`${resourceId}.${value}`, `${value}${resourceId}`],
					resourceId,
				},
			),
		);
	}
}

function editable(editId, path, type, options = {}) {
	return { ...options, editId, path, type };
}

function add(id, labelName, options = {}) {
	if (definitionsById.has(id)) {
		throw new Error(`Duplicate character field: ${id}`);
	}
	const definition = Object.freeze({
		id,
		...(labelName ? { labelKey: `character.fields.${labelName}` } : {}),
		...options,
	});
	definitions.push(definition);
	definitionsById.set(id, definition);
	registerAlias(id, definition);
	for (const alias of options.aliases ?? []) {
		registerAlias(alias, definition);
	}
	if (definition.editId) {
		registerAlias(definition.editId, definition);
	}
	if (definition.viewId) {
		registerAlias(definition.viewId, definition);
	}
}

function registerAlias(alias, definition) {
	for (const key of [alias, alias.toLowerCase(), normalizeLoose(alias)]) {
		const existing = aliases.get(key);
		if (existing && existing !== definition) {
			throw new Error(`Duplicate character field alias: ${alias}`);
		}
		aliases.set(key, definition);
	}
}

function normalizeLoose(value) {
	return String(value).toLowerCase().replace(/[^a-z]/g, '');
}

function getCharacterFieldDefinition(fieldId) {
	if (typeof fieldId !== 'string') {
		return null;
	}
	return definitionsById.get(fieldId)
		?? aliases.get(fieldId)
		?? aliases.get(fieldId.toLowerCase())
		?? aliases.get(normalizeLoose(fieldId))
		?? null;
}

function getEditableFieldDefinition(fieldId) {
	const definition = getCharacterFieldDefinition(fieldId);
	return definition?.editId ? definition : null;
}

function getEditableFields() {
	return definitions.filter(definition => definition.editId);
}

function getViewableFieldDefinition(fieldId) {
	const definition = getCharacterFieldDefinition(fieldId);
	return definition?.viewId ? definition : null;
}

function getViewableFields() {
	return definitions.filter(definition => definition.viewId);
}

module.exports = {
	CHARACTER_FIELD_DEFINITIONS: Object.freeze([...definitions]),
	getCharacterFieldDefinition,
	getEditableFieldDefinition,
	getEditableFields,
	getViewableFieldDefinition,
	getViewableFields,
};

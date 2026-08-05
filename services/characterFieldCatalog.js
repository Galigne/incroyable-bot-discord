const { BASE_STATS, DERIVED_STATS } = require('./mechanics/constants');

const definitions = [];
const definitionsById = new Map();
const aliases = new Map();
const editableAliases = new Map();

const SECTION_IDS = Object.freeze([
	'name',
	'level',
	'status',
	'statistics',
	'rules',
	'talents',
	'gear',
	'race',
	'background',
	'personality',
]);

addSection('name', 'name', 'multi', ['firstName', 'lastName']);
addSection('level', 'level', 'scalar', ['level.value']);
addSection('status', 'status', 'multi', [
	'resources.hp',
	'resources.ar',
	'resources.ap',
	'resources.md',
	'statusEffects',
]);
addSection(
	'statistics',
	'statistics',
	'named-lines',
	[...BASE_STATS, ...DERIVED_STATS].map(stat => `stats.${stat}`),
	{ aliases: ['stats'] },
);
addSection('rules', 'rules', 'multiline', ['rules.value']);
addSection('talents', 'talents', 'multiline', ['talents.value']);
addSection('gear', 'gear', 'multi', ['equipment', 'inventory', 'encumbrance']);
addSection('race', 'race', 'multi', [
	'race.name',
	'race.physicalDescription',
	'race.lore',
	'racialTraits.skillBonus',
	'racialTraits.physicalAbility',
]);
addSection('background', 'background', 'multi', [
	'appearance',
	'backstory',
	'goals',
]);
addSection('personality', 'personality', 'multi', [
	'personality.traits',
	'personality.description',
]);

add('key', 'characterKey');
add('firstName', 'firstName', stored(['firstName'], 'text', {
	aliases: ['firstname'],
}));
add('lastName', 'lastName', stored(['lastName'], 'text', {
	aliases: ['lastname'],
}));
add('level.value', 'level', stored(['level'], 'number', {
	aliases: ['levelValue'],
}));
add('race.name', 'raceName', stored(['race', 'name'], 'text', {
	aliases: ['racename'],
}));
add('race.physicalDescription', 'racePhysicalDescription', stored(
	['race', 'physicalDescription'],
	'text',
	{
		aliases: ['race.description', 'racedescription'],
		paragraph: true,
	},
));
add('race.lore', 'raceLore', stored(['race', 'lore'], 'text', {
	aliases: ['racelore'],
	paragraph: true,
}));
add('appearance', 'appearance', stored(['appearance'], 'text', {
	paragraph: true,
}));
add('backstory', 'backstory', stored(['backstory'], 'text', {
	paragraph: true,
}));
add('goals', 'goals', stored(['goals'], 'text', {
	paragraph: true,
}));
add('personality.description', 'personalityDescription', stored(
	['personality', 'description'],
	'text',
	{ aliases: ['personalitydescription'], paragraph: true },
));
add('personality.traits', 'personalityTraits', stored(
	['personality', 'traits'],
	'text',
	{ aliases: ['personalitytraits'], multiline: true, paragraph: true },
));
add('racialTraits', 'racialTraits', { aliases: ['racialtraits'] });
add('racialTraits.skillBonus', 'racialSkillBonus', stored(
	['racialTraits', 'skillBonus'],
	'text',
	{
		aliases: ['racialtrait.skillbonus', 'racialtraits.skillbonus'],
		paragraph: true,
	},
));
add('racialTraits.physicalAbility', 'racialPhysicalAbility', stored(
	['racialTraits', 'physicalAbility'],
	'text',
	{
		aliases: ['racialtrait.physicalability', 'racialtraits.physicalability'],
		paragraph: true,
	},
));
add('statistics.base', 'baseStatistics', { aliases: ['baseStatistics'] });
add('statistics.derived', 'derivedStatistics', { aliases: ['derivedStatistics'] });

for (const stat of [...BASE_STATS, ...DERIVED_STATS]) {
	add(`stats.${stat}`, stat, stored(
		['stats', stat],
		'number',
		{ aliases: [stat] },
	));
}

add('rules.value', 'rules', stored(['rules'], 'text', {
	aliases: ['rule'],
	multiline: true,
	paragraph: true,
	rules: true,
}));
add('rules.name', 'ruleName');
add('rules.level', 'ruleLevel');
add('rules.description', 'ruleDescription');
add('talents.value', 'talents', stored(['talents'], 'text', {
	multiline: true,
	paragraph: true,
}));
add('statusEffects', 'statusEffects', stored(['statusEffects'], 'text', {
	aliases: ['statuseffect', 'statuseffects'],
	multiline: true,
	paragraph: true,
}));
add('equipment', 'equipment', stored(['equipment'], 'text', {
	multiline: true,
	paragraph: true,
}));
add('inventory', 'inventory', stored(['inventory'], 'text', {
	multiline: true,
	paragraph: true,
}));
add('encumbrance', 'encumbrance', pairInput([
	'encumbrance.current',
	'encumbrance.max',
]));
add('encumbrance.current', 'currentEncumbrance', stored(
	['encumbrance', 'current'],
	'number',
	{ aliases: ['encumbrancecapacity.current'] },
));
add('encumbrance.max', 'maximumEncumbrance', stored(
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
		...pairInput([
			`resources.${resourceId}.current`,
			`resources.${resourceId}.max`,
		]),
	});
	for (const value of ['current', 'max']) {
		add(
			`resources.${resourceId}.${value}`,
			value === 'current' ? 'currentResource' : 'maximumResource',
			stored(
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

function addSection(id, labelName, editKind, editInputIds, options = {}) {
	add(id, labelName, {
		...options,
		editId: id,
		editInputIds: Object.freeze([...editInputIds]),
		editKind,
		sectionId: id,
		sectionOrder: SECTION_IDS.indexOf(id),
		viewId: id,
		viewTargetIds: Object.freeze([...editInputIds]),
	});
}

function stored(path, type, options = {}) {
	return { ...options, path: Object.freeze([...path]), type };
}

function pairInput(inputTargetIds) {
	return {
		inputKind: 'pair',
		inputTargetIds: Object.freeze([...inputTargetIds]),
	};
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
		registerEditableAlias(definition.editId, definition);
	}
}

function registerAlias(alias, definition) {
	registerMappedAlias(aliases, alias, definition, 'character field');
}

function registerEditableAlias(alias, definition) {
	for (const key of [alias, alias.toLowerCase()]) {
		const existing = editableAliases.get(key);
		if (existing && existing !== definition) {
			throw new Error(`Duplicate editable field alias: ${alias}`);
		}
		editableAliases.set(key, definition);
	}
}

function registerMappedAlias(map, alias, definition, label) {
	for (const key of [alias, alias.toLowerCase(), normalizeLoose(alias)]) {
		const existing = map.get(key);
		if (existing && existing !== definition) {
			throw new Error(`Duplicate ${label} alias: ${alias}`);
		}
		map.set(key, definition);
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
	if (typeof fieldId !== 'string') {
		return null;
	}
	return editableAliases.get(fieldId)
		?? editableAliases.get(fieldId.toLowerCase())
		?? null;
}

function getCharacterSections() {
	return SECTION_IDS.map(id => definitionsById.get(id));
}

function getEditableFields() {
	return getCharacterSections();
}

function getViewableFieldDefinition(fieldId) {
	if (typeof fieldId !== 'string') {
		return null;
	}
	const definition = definitionsById.get(fieldId)
		?? definitionsById.get(fieldId.toLowerCase());
	return definition?.sectionId ? definition : null;
}

function getViewableFields() {
	return getCharacterSections();
}

module.exports = {
	CHARACTER_FIELD_DEFINITIONS: Object.freeze([...definitions]),
	CHARACTER_SECTION_IDS: SECTION_IDS,
	getCharacterFieldDefinition,
	getCharacterSections,
	getEditableFieldDefinition,
	getEditableFields,
	getViewableFieldDefinition,
	getViewableFields,
};

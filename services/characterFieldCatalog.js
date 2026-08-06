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
	'modifiers',
]);

addSection('name', 'name', 'multi', ['name.firstName', 'name.lastName']);
addSection('level', 'level', 'scalar', ['level.value']);
addSection('status', 'status', 'multi', [
	'status.hp',
	'status.ar',
	'status.ap',
	'status.md',
	'status.effects',
]);
addSection(
	'statistics',
	'statistics',
	'named-lines',
	[...BASE_STATS, ...DERIVED_STATS].map(stat => `statistics.${stat}`),
	{ aliases: ['stats'] },
);
addSection('rules', 'rules', 'multiline', ['rules.value']);
addSection('talents', 'talents', 'multiline', ['talents.value']);
addSection('gear', 'gear', 'multi', [
	'gear.equipment',
	'gear.inventory',
	'gear.encumbrance',
]);
addSection('race', 'race', 'multi', [
	'race.name',
	'race.physicalDescription',
	'race.lore',
	'race.traits.skillBonus',
	'race.traits.physicalAbility',
]);
addSection('background', 'background', 'multi', [
	'background.appearance',
	'background.backstory',
	'background.goals',
]);
addSection('personality', 'personality', 'multi', [
	'personality.traits',
	'personality.description',
]);
addSection('modifiers', 'modifiers', 'multiline', ['modifiers.value']);

add('key', 'characterKey');
add('name.firstName', 'firstName', stored(['name', 'firstName'], 'text', {
	aliases: ['firstName', 'firstname'],
}));
add('name.lastName', 'lastName', stored(['name', 'lastName'], 'text', {
	aliases: ['lastName', 'lastname'],
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
add('background.appearance', 'appearance', stored(
	['background', 'appearance'],
	'text',
	{ aliases: ['appearance'], paragraph: true },
));
add('background.backstory', 'backstory', stored(
	['background', 'backstory'],
	'text',
	{ aliases: ['backstory'], paragraph: true },
));
add('background.goals', 'goals', stored(
	['background', 'goals'],
	'text',
	{ aliases: ['goals'], paragraph: true },
));
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
add('race.traits', 'racialTraits', { aliases: ['racialTraits', 'racialtraits'] });
add('race.traits.skillBonus', 'racialSkillBonus', stored(
	['race', 'traits', 'skillBonus'],
	'text',
	{
		aliases: [
			'racialTraits.skillBonus',
			'racialtrait.skillbonus',
			'racialtraits.skillbonus',
		],
		paragraph: true,
	},
));
add('race.traits.physicalAbility', 'racialPhysicalAbility', stored(
	['race', 'traits', 'physicalAbility'],
	'text',
	{
		aliases: [
			'racialTraits.physicalAbility',
			'racialtrait.physicalability',
			'racialtraits.physicalability',
		],
		paragraph: true,
	},
));
add('statistics.base', 'baseStatistics', { aliases: ['baseStatistics'] });
add('statistics.derived', 'derivedStatistics', { aliases: ['derivedStatistics'] });

for (const stat of [...BASE_STATS, ...DERIVED_STATS]) {
	add(`statistics.${stat}`, stat, stored(
		['statistics', stat],
		'number',
		{ aliases: [`stats.${stat}`, stat] },
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
add('modifiers.value', 'modifiers', stored(['modifiers'], 'text', {
	described: true,
	multiline: true,
	paragraph: true,
}));
add('status.effects', 'statusEffects', stored(['status', 'effects'], 'text', {
	aliases: ['statusEffects', 'statuseffect', 'statuseffects'],
	multiline: true,
	paragraph: true,
}));
add('gear.equipment', 'equipment', stored(['gear', 'equipment'], 'text', {
	aliases: ['equipment'],
	multiline: true,
	paragraph: true,
}));
add('gear.inventory', 'inventory', stored(['gear', 'inventory'], 'text', {
	aliases: ['inventory'],
	multiline: true,
	paragraph: true,
}));
add('gear.encumbrance', 'encumbrance', {
	aliases: ['encumbrance'],
	...pairInput([
		'gear.encumbrance.current',
		'gear.encumbrance.max',
	]),
});
add('gear.encumbrance.current', 'currentEncumbrance', stored(
	['gear', 'encumbrance', 'current'],
	'number',
	{ aliases: ['encumbrance.current', 'encumbrancecapacity.current'] },
));
add('gear.encumbrance.max', 'maximumEncumbrance', stored(
	['gear', 'encumbrance', 'max'],
	'number',
	{ aliases: ['encumbrance.max', 'encumbrancecapacity.max'] },
));

for (const resourceId of ['hp', 'ar', 'ap', 'md']) {
	add(`status.${resourceId}`, null, {
		abbreviationKey: `character.resources.${resourceId}.abbreviation`,
		aliases: [`resources.${resourceId}`, resourceId, resourceId.toUpperCase()],
		labelKey: `character.resources.${resourceId}.name`,
		resourceId,
		...pairInput([
			`status.${resourceId}.current`,
			`status.${resourceId}.max`,
		]),
	});
	for (const value of ['current', 'max']) {
		add(
			`status.${resourceId}.${value}`,
			value === 'current' ? 'currentResource' : 'maximumResource',
			stored(
				['status', resourceId, value],
				'number',
				{
					aliases: [
						`resources.${resourceId}.${value}`,
						`${resourceId}.${value}`,
						`${value}${resourceId}`,
					],
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

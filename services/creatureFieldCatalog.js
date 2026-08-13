const { BASE_STATS, DERIVED_STATS } = require('./mechanics/constants');

const definitions = [];
const definitionsById = new Map();
const aliases = new Map();
const editableAliases = new Map();

const SECTION_IDS = Object.freeze([
	'identity',
	'level',
	'resources',
	'status',
	'statistics',
	'rules',
	'traits',
	'gear',
]);

addSection('identity', 'multi', ['identity.name', 'identity.description']);
addSection('level', 'scalar', ['level.value']);
addSection('resources', 'multi', [
	'resources.hp',
	'resources.ar',
	'resources.ap',
	'resources.md',
]);
addSection('status', 'multi', [
	'status.effects',
	'status.modifiers',
]);
addSection(
	'statistics',
	'named-lines',
	[...BASE_STATS, ...DERIVED_STATS].map(stat => `statistics.${stat}`),
	{ aliases: ['stats'] },
);
addSection('rules', 'multiline', ['rules.value']);
addSection('traits', 'multiline', ['traits.value']);
addSection('gear', 'multi', [
	'gear.equipment',
	'gear.inventory',
	'gear.encumbrance',
]);

add('key', 'creature.fields.entityKey');
add('identity.name', 'creature.fields.name', stored(['name'], 'text', {
	aliases: ['name'],
	maxLength: 256,
}));
add('identity.description', 'creature.fields.description', stored(
	['description'],
	'text',
	{ aliases: ['description'], paragraph: true },
));
add('level.value', 'character.fields.level', stored(['level'], 'number'));

for (const stat of [...BASE_STATS, ...DERIVED_STATS]) {
	add(
		`statistics.${stat}`,
		`character.fields.${stat}`,
		stored(['statistics', stat], 'number', {
			aliases: [`stats.${stat}`, stat],
		}),
	);
}

add('statistics.base', 'character.fields.baseStatistics');
add('statistics.derived', 'character.fields.derivedStatistics');
add('rules.value', 'character.fields.rules', stored(['rules'], 'text', {
	multiline: true,
	paragraph: true,
	rules: true,
}));
add('traits.value', 'creature.fields.traits', stored(['traits'], 'text', {
	multiline: true,
	paragraph: true,
}));
add('status.effects', 'character.fields.statusEffects', stored(
	['status', 'effects'],
	'text',
	{ described: true, multiline: true, paragraph: true },
));
add('status.modifiers', 'creature.fields.modifiers', stored(
	['status', 'modifiers'],
	'text',
	{ described: true, multiline: true, paragraph: true },
));
add('gear.equipment', 'character.fields.equipment', stored(
	['gear', 'equipment'],
	'text',
	{ multiline: true, paragraph: true },
));
add('gear.inventory', 'character.fields.inventory', stored(
	['gear', 'inventory'],
	'text',
	{ multiline: true, paragraph: true },
));
add('gear.encumbrance', 'character.fields.encumbrance', {
	...pairInput(['gear.encumbrance.current', 'gear.encumbrance.max']),
});
add('gear.encumbrance.current', 'character.fields.currentEncumbrance', stored(
	['gear', 'encumbrance', 'current'],
	'number',
));
add('gear.encumbrance.max', 'character.fields.maximumEncumbrance', stored(
	['gear', 'encumbrance', 'max'],
	'number',
));

for (const resourceId of ['hp', 'ar', 'ap', 'md']) {
	add(`resources.${resourceId}`, `character.resources.${resourceId}.name`, {
		abbreviationKey: `character.resources.${resourceId}.abbreviation`,
		aliases: [`resources.${resourceId}`, resourceId, resourceId.toUpperCase()],
		resourceId,
		...pairInput([
			`resources.${resourceId}.current`,
			`resources.${resourceId}.max`,
		]),
	});
	for (const value of ['current', 'max']) {
		add(
			`resources.${resourceId}.${value}`,
			value === 'current'
				? 'character.fields.currentResource'
				: 'character.fields.maximumResource',
			stored(['resources', resourceId, value], 'number', { resourceId }),
		);
	}
}

function addSection(id, editKind, editInputIds, options = {}) {
	add(id, `creature.fields.${id}`, {
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

function add(id, labelKey, options = {}) {
	if (definitionsById.has(id)) {
		throw new Error(`Duplicate creature field: ${id}`);
	}
	const definition = Object.freeze({ id, labelKey, ...options });
	definitions.push(definition);
	definitionsById.set(id, definition);
	for (const alias of [id, ...(options.aliases ?? [])]) {
		registerAlias(aliases, alias, definition, 'creature field');
	}
	if (definition.editId) {
		registerAlias(editableAliases, definition.editId, definition, 'editable field');
	}
}

function registerAlias(map, alias, definition, label) {
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

function getCreatureFieldDefinition(fieldId) {
	if (typeof fieldId !== 'string') {
		return null;
	}
	return definitionsById.get(fieldId)
		?? aliases.get(fieldId)
		?? aliases.get(fieldId.toLowerCase())
		?? aliases.get(normalizeLoose(fieldId))
		?? null;
}

function getEditableCreatureFieldDefinition(fieldId) {
	if (typeof fieldId !== 'string') {
		return null;
	}
	return editableAliases.get(fieldId)
		?? editableAliases.get(fieldId.toLowerCase())
		?? editableAliases.get(normalizeLoose(fieldId))
		?? null;
}

function getCreatureSections() {
	return SECTION_IDS.map(id => definitionsById.get(id));
}

function getViewableCreatureFieldDefinition(fieldId) {
	const definition = getCreatureFieldDefinition(fieldId);
	return definition?.sectionId ? definition : null;
}

module.exports = {
	CREATURE_FIELD_DEFINITIONS: Object.freeze([...definitions]),
	CREATURE_SECTION_IDS: SECTION_IDS,
	getCreatureFieldDefinition,
	getCreatureSections,
	getEditableCreatureFieldDefinition,
	getViewableCreatureFieldDefinition,
};

const { BASE_STATS, DERIVED_STATS } = require('./mechanics/constants');
const {
	createFieldCatalogBuilder,
	definePairInput: pairInput,
	defineStoredField: stored,
} = require('./fieldCatalogBuilder');

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

const catalogBuilder = createFieldCatalogBuilder({
	catalogName: 'creature',
	sectionIds: SECTION_IDS,
});

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
	catalogBuilder.addSection(
		id,
		`creature.fields.${id}`,
		editKind,
		editInputIds,
		options,
	);
}

function add(id, labelKey, options = {}) {
	catalogBuilder.addField(id, labelKey, options);
}

const catalog = catalogBuilder.build();
const {
	definitions: CREATURE_FIELD_DEFINITIONS,
	getEditableFieldDefinition: getEditableCreatureFieldDefinition,
	getFieldDefinition: getCreatureFieldDefinition,
	getSections: getCreatureSections,
	getViewableFieldDefinition: getViewableCreatureFieldDefinition,
} = catalog;

module.exports = {
	CREATURE_FIELD_DEFINITIONS,
	CREATURE_SECTION_IDS: SECTION_IDS,
	getCreatureFieldDefinition,
	getCreatureSections,
	getEditableCreatureFieldDefinition,
	getViewableCreatureFieldDefinition,
};

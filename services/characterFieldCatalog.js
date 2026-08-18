const { BASE_STATS, DERIVED_STATS } = require('./mechanics/constants');
const {
	createFieldCatalogBuilder,
	definePairInput: pairInput,
	defineStoredField: stored,
} = require('./fieldCatalogBuilder');

const SECTION_IDS = Object.freeze([
	'name',
	'level',
	'resources',
	'status',
	'statistics',
	'rules',
	'talents',
	'gear',
	'race',
	'background',
	'personality',
]);

const catalogBuilder = createFieldCatalogBuilder({
	catalogName: 'character',
	sectionIds: SECTION_IDS,
});

addSection('name', 'name', 'multi', ['name.firstName', 'name.lastName']);
addSection('level', 'level', 'scalar', ['level.value']);
addSection('resources', 'resources', 'multi', [
	'resources.hp',
	'resources.ar',
	'resources.ap',
	'resources.md',
]);
addSection('status', 'status', 'multi', [
	'status.effects',
	'status.modifiers',
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
	'background.backstory',
	'background.goals',
], {
	viewTargetIds: [
		'background.archetype',
		'background.physicalDescription',
		'background.backstory',
		'background.goals',
	],
});
addSection('personality', 'personality', 'multi', [
	'personality.traits',
	'personality.description',
]);

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
add('background.archetype', 'backgroundArchetype', stored(
	['background', 'archetype'],
	'text',
));
add('background.physicalDescription', 'backgroundPhysicalDescription', stored(
	['background', 'physicalDescription'],
	'text',
	{ paragraph: true },
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
add('status.effects', 'statusEffects', stored(['status', 'effects'], 'text', {
	aliases: ['statusEffects', 'statuseffect', 'statuseffects'],
	described: true,
	multiline: true,
	paragraph: true,
}));
add('status.modifiers', 'modifiers', stored(['status', 'modifiers'], 'text', {
	multiline: true,
	paragraph: true,
	described: true,
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
	add(`resources.${resourceId}`, null, {
		abbreviationKey: `character.resources.${resourceId}.abbreviation`,
		aliases: [`resources.${resourceId}`, resourceId, resourceId.toUpperCase()],
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
	catalogBuilder.addSection(
		id,
		`character.fields.${labelName}`,
		editKind,
		editInputIds,
		options,
	);
}

function add(id, labelName, options = {}) {
	catalogBuilder.addField(
		id,
		labelName ? `character.fields.${labelName}` : undefined,
		options,
	);
}

const catalog = catalogBuilder.build();
const {
	definitions: CHARACTER_FIELD_DEFINITIONS,
	getEditableFieldDefinition,
	getEditableFields,
	getFieldDefinition: getCharacterFieldDefinition,
	getSections: getCharacterSections,
	getViewableFieldDefinition,
	getViewableFields,
} = catalog;

module.exports = {
	CHARACTER_FIELD_DEFINITIONS,
	CHARACTER_SECTION_IDS: SECTION_IDS,
	getCharacterFieldDefinition,
	getCharacterSections,
	getEditableFieldDefinition,
	getEditableFields,
	getViewableFieldDefinition,
	getViewableFields,
};

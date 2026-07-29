const { BASE_STATS, DERIVED_STATS } = require('./mechanics/constants');

const definitions = [];
const definitionsById = new Map();
const aliases = new Map();
const editableAliases = new Map();

add('key', 'characterKey');
add('name', 'name', {
	viewId: 'name',
	...editable('name', 'colon', ['firstName', 'lastName']),
});
add('firstName', 'firstName', stored(['firstName'], 'text', {
	aliases: ['firstname'],
	viewId: 'firstName',
}));
add('lastName', 'lastName', stored(['lastName'], 'text', {
	aliases: ['lastname'],
	viewId: 'lastName',
}));
add('level', 'level', {
	...stored(['level'], 'number'),
	...editable('level', 'scalar', ['level']),
	viewId: 'level',
});
add('race', 'race', {
	viewId: 'race',
	...editable('race', 'multi', [
		'race.name',
		'race.physicalDescription',
		'race.lore',
		'racialTraits.skillBonus',
		'racialTraits.physicalAbility',
	]),
});
add('background', 'background', editable('background', 'multi', [
	'appearance',
	'backstory',
	'goals',
]));
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
	viewId: 'appearance',
}));
add('backstory', 'backstory', stored(['backstory'], 'text', {
	paragraph: true,
	viewId: 'backstory',
}));
add('goals', 'goals', stored(['goals'], 'text', {
	paragraph: true,
	viewId: 'goals',
}));
add('personality', 'personality', {
	viewId: 'personality',
	...editable('personality', 'multi', [
		'personality.description',
		'personality.traits',
	]),
});
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
add('racialTraits', 'racialTraits', {
	aliases: ['racialtraits'],
	viewId: 'racialTraits',
});
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
add('statistics', 'statistics', { aliases: ['stats'], viewId: 'statistics' });
add('statistics.base', 'baseStatistics', {
	aliases: ['baseStatistics'],
	...editable('base-statistics', 'colon', BASE_STATS.map(stat => `stats.${stat}`)),
});
add('statistics.derived', 'derivedStatistics', {
	aliases: ['derivedStatistics'],
	...editable(
		'derived-statistics',
		'colon',
		DERIVED_STATS.map(stat => `stats.${stat}`),
	),
});

for (const stat of [...BASE_STATS, ...DERIVED_STATS]) {
	add(`stats.${stat}`, stat, stored(
		['stats', stat],
		'number',
		{ aliases: [stat] },
	));
}

add('rules', 'rules', {
	...stored(['rules'], 'text', {
		aliases: ['rule'],
		multiline: true,
		paragraph: true,
		rules: true,
	}),
	...editable('rules', 'multiline', ['rules']),
	viewId: 'rules',
});
add('rules.name', 'ruleName');
add('rules.level', 'ruleLevel');
add('rules.description', 'ruleDescription');
add('talents', 'talents', {
	...stored(['talents'], 'text', { paragraph: true }),
	...editable('talents', 'scalar', ['talents']),
	viewId: 'talents',
});
add('status', 'status', { viewId: 'status' });
add('statusEffects', 'statusEffects', {
	...stored(['statusEffects'], 'text', {
		aliases: ['statuseffect', 'statuseffects'],
		multiline: true,
		paragraph: true,
	}),
	...editable('status-effects', 'multiline', ['statusEffects']),
	viewId: 'statusEffects',
});
add('equipment', 'equipment', {
	...stored(['equipment'], 'text', {
		multiline: true,
		paragraph: true,
	}),
	...editable('equipment', 'multiline', ['equipment']),
	viewId: 'equipment',
});
add('inventory', 'inventory', {
	...stored(['inventory'], 'text', {
		multiline: true,
		paragraph: true,
	}),
	...editable('inventory', 'multiline', ['inventory']),
	viewId: 'inventory',
});
add('encumbrance', 'encumbrance', {
	viewId: 'encumbrance',
	...editable('encumbrance', 'colon', [
		'encumbrance.current',
		'encumbrance.max',
	]),
});
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
		viewId: resourceId.toUpperCase(),
		...editable(resourceId, 'colon', [
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

function stored(path, type, options = {}) {
	return { ...options, path: Object.freeze([...path]), type };
}

function editable(editId, editKind, editTargetIds) {
	return {
		editId,
		editKind,
		editTargetIds: Object.freeze([...editTargetIds]),
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
		registerAlias(definition.editId, definition);
		registerEditableAlias(definition.editId, definition);
	}
	if (definition.viewId) {
		registerAlias(definition.viewId, definition);
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

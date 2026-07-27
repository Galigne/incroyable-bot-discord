const { BASE_STATS, DERIVED_STATS, MAX_AP } = require('../models/Character');

const scalarFields = buildScalarFields();
const multilineFields = new Map([
	['personalitytraits', { path: ['personality', 'traits'], label: 'personality trait' }],
	['rules', { path: ['rules'], label: 'RULE', rules: true }],
	['statuseffects', { path: ['statusEffects'], label: 'status effect' }],
	['equipment', { path: ['equipment'], label: 'equipment item' }],
	['inventory', { path: ['inventory'], label: 'inventory item' }],
]);

function dealDamage(character, damageAmount, piercing = false) {
	if (!Number.isSafeInteger(damageAmount) || damageAmount <= 0) {
		throw editError('Damage must be a positive whole number.');
	}
	if (typeof piercing !== 'boolean') {
		throw editError('Piercing must be true or false.');
	}

	const availableAr = Math.max(0, character.resources.ar.current);
	const availableHp = Math.max(0, character.resources.hp.current);
	const arDamage = piercing ? 0 : Math.min(availableAr, damageAmount);
	const damageAfterArmor = damageAmount - arDamage;
	const hpDamage = Math.min(availableHp, damageAfterArmor);

	character.resources.ar.current = availableAr - arDamage;
	character.resources.hp.current = availableHp - hpDamage;

	return {
		arDamage,
		hpDamage,
		piercing,
	};
}

function restoreResource(character, resourceName, percentage) {
	const resource = resourceName.toLowerCase();
	if (!['hp', 'ar'].includes(resource)) {
		throw editError('Only HP and AR can be restored with the rest command.');
	}
	if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
		throw editError('The rest percentage must be between 0 and 100.');
	}
	const target = character.resources[resource];
	target.current = Math.round(target.max * percentage / 100);
	return target;
}

function resetTurnResources(character) {
	character.resources.ap.current = character.resources.ap.max;
	character.resources.md.current = character.resources.md.max;
}

function getEditableFieldValue(character, fieldName) {
	const key = normalizeFieldName(fieldName);
	const scalarField = scalarFields.get(key);
	if (scalarField) {
		return String(getAtPath(character, scalarField.path) ?? '');
	}

	const multilineField = multilineFields.get(key);
	if (multilineField) {
		return getAtPath(character, multilineField.path)
			.map(item => multilineField.rules
				? `${item.name}: ${item.level}: ${item.description}`
				: item)
			.join('\n');
	}

	throw editError(`Unknown field: ${fieldName}.`);
}

function setEditableFieldValue(character, fieldName, value) {
	const key = normalizeFieldName(fieldName);
	const scalarField = scalarFields.get(key);
	if (scalarField) {
		const args = value.trim() ? [value] : ['clear'];
		return editScalar(character, scalarField, args);
	}

	const multilineField = multilineFields.get(key);
	if (multilineField) {
		const lines = value
			.split(/\r?\n/)
			.map(line => line.trim().replace(/^[-*]\s+/, ''))
			.filter(Boolean);
		const entries = getAtPath(character, multilineField.path);
		entries.splice(
			0,
			entries.length,
			...lines.map(line => parseMultilineEntry(multilineField, line)),
		);
		return `${multilineField.label} field updated.`;
	}

	throw editError(`Unknown field: ${fieldName}.`);
}

function editScalar(character, field, args) {
	if (args.length === 0) {
		throw editError(`A value is required for ${field.label}.`);
	}

	let value = args.join(' ').trim();
	if (field.type === 'number') {
		value = Number(value);
		if (!Number.isFinite(value)) {
			throw editError(`${field.label} must be a number.`);
		}
		if (
			field.path[0] === 'resources'
			&& field.path[1] === 'ap'
			&& (!Number.isInteger(value) || value < 0 || value > MAX_AP)
		) {
			throw editError(`AP must be a whole number between 0 and ${MAX_AP}.`);
		}
		if (
			field.path[0] === 'resources'
			&& field.path[1] === 'ap'
			&& field.path[2] === 'current'
			&& value > character.resources.ap.max
		) {
			throw editError('Current AP cannot be greater than maximum AP.');
		}
		if (
			field.path[0] === 'resources'
			&& field.path[1] === 'ap'
			&& field.path[2] === 'max'
			&& value < character.resources.ap.current
		) {
			throw editError('Maximum AP cannot be lower than current AP.');
		}
	}
	else if (value.toLowerCase() === 'clear') {
		value = '';
	}

	setAtPath(character, field.path, value);
	return `${field.label} updated.`;
}

function parseMultilineEntry(field, line) {
	const value = line.trim();
	if (!value) {
		throw editError(`A value is required for the ${field.label}.`);
	}
	if (!field.rules) {
		return value;
	}

	const separatorIndex = value.indexOf(':');
	const name = (separatorIndex === -1 ? value : value.slice(0, separatorIndex)).trim();
	const remainder = separatorIndex === -1 ? '' : value.slice(separatorIndex + 1).trim();
	if (!name) {
		throw editError('A RULE name is required before the `:` separator.');
	}
	const levelSeparatorIndex = remainder.indexOf(':');
	const possibleLevel = levelSeparatorIndex === -1
		? remainder
		: remainder.slice(0, levelSeparatorIndex).trim();
	const hasExplicitLevel = /^\d+$/.test(possibleLevel) && levelSeparatorIndex !== -1;
	const level = hasExplicitLevel ? Number(possibleLevel) : 1;
	if (!Number.isSafeInteger(level) || level < 1) {
		throw editError('A RULE level must be a positive whole number.');
	}
	const description = hasExplicitLevel
		? remainder.slice(levelSeparatorIndex + 1).trim()
		: remainder;
	return { name, description, level };
}

function buildScalarFields() {
	const fields = new Map();
	addScalar(fields, ['firstname'], ['firstName'], 'first name', 'text');
	addScalar(fields, ['lastname'], ['lastName'], 'last name', 'text');
	addScalar(fields, ['level'], ['level'], 'level', 'number');
	addScalar(fields, ['race.name', 'racename'], ['race', 'name'], 'race name', 'text');
	addScalar(
		fields,
		['race.description', 'race.physicaldescription', 'racedescription'],
		['race', 'physicalDescription'],
		'race physical description',
		'text',
	);
	addScalar(fields, ['race.lore', 'racelore'], ['race', 'lore'], 'race lore', 'text');
	addScalar(fields, ['appearance'], ['appearance'], 'appearance', 'text');
	addScalar(fields, ['backstory'], ['backstory'], 'backstory', 'text');
	addScalar(fields, ['goals'], ['goals'], 'goals', 'text');
	addScalar(
		fields,
		['personality.description', 'personalitydescription'],
		['personality', 'description'],
		'personality description',
		'text',
	);
	addScalar(
		fields,
		['racialtrait.skillbonus', 'racialtraits.skillbonus'],
		['racialTraits', 'skillBonus'],
		'racial skill bonus',
		'text',
	);
	addScalar(
		fields,
		['racialtrait.physicalability', 'racialtraits.physicalability'],
		['racialTraits', 'physicalAbility'],
		'racial physical ability',
		'text',
	);
	addScalar(fields, ['talents'], ['talents'], 'talents', 'text');

	for (const stat of [...BASE_STATS, ...DERIVED_STATS]) {
		addScalar(fields, [`stats.${stat}`, stat], ['stats', stat], stat, 'number');
	}
	for (const resource of ['hp', 'ar', 'ap', 'md']) {
		for (const value of ['current', 'max']) {
			addScalar(
				fields,
				[`${resource}.${value}`, `${value}${resource}`],
				['resources', resource, value],
				`${value} ${resource.toUpperCase()}`,
				'number',
			);
		}
	}
	for (const value of ['current', 'max']) {
		addScalar(
			fields,
			[`encumbrance.${value}`, `encumbrancecapacity.${value}`],
			['encumbrance', value],
			`${value} encumbrance`,
			'number',
		);
	}
	return fields;
}

function addScalar(fields, aliases, path, label, type) {
	for (const alias of aliases) {
		fields.set(normalizeFieldName(alias), { path, label, type });
	}
}

function normalizeFieldName(value = '') {
	return value.toLowerCase().replace(/[^a-z]/g, '');
}

function getAtPath(object, path) {
	return path.reduce((value, key) => value[key], object);
}

function setAtPath(object, path, value) {
	const parent = path.slice(0, -1).reduce((target, key) => target[key], object);
	parent[path.at(-1)] = value;
}

function editError(message) {
	const error = new Error(message);
	error.code = 'INVALID_CHARACTER_EDIT';
	return error;
}

module.exports = {
	dealDamage,
	getEditableFieldValue,
	normalizeFieldName,
	resetTurnResources,
	restoreResource,
	setEditableFieldValue,
};

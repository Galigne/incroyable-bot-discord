const { BASE_STATS, DERIVED_STATS } = require('./mechanics/constants');
const {
	characterEditError,
	validateActionPointEdit,
} = require('./mechanics/characterValidation');
const { dealDamage } = require('./mechanics/damage');
const {
	resetTurnResources,
	restoreResource,
} = require('./mechanics/resources');
const { t } = require('../util/i18n');
const { getCharacterFieldLabel } = require('../util/characterDisplay');

const scalarFields = buildScalarFields();
const multilineFields = new Map([
	['personalitytraits', { fieldId: 'personality.traits', path: ['personality', 'traits'] }],
	['rules', { fieldId: 'rules', path: ['rules'], rules: true }],
	['statuseffects', { fieldId: 'statusEffects', path: ['statusEffects'] }],
	['equipment', { fieldId: 'equipment', path: ['equipment'] }],
	['inventory', { fieldId: 'inventory', path: ['inventory'] }],
]);

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

function setEditableFieldValue(character, fieldName, value, locale = 'en') {
	const key = normalizeFieldName(fieldName);
	const scalarField = scalarFields.get(key);
	if (scalarField) {
		const args = value.trim() ? [value] : ['clear'];
		return editScalar(character, scalarField, args, locale);
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
			...lines.map(line => parseMultilineEntry(multilineField, line, locale)),
		);
		return t(locale, 'editorResults.collectionUpdated', {
			field: getCharacterFieldLabel(locale, multilineField.fieldId),
		});
	}

	throw editError(t(locale, 'errors.unknownEditField', { field: fieldName }));
}

function editScalar(character, field, args, locale) {
	const label = getCharacterFieldLabel(locale, field.fieldId);
	if (args.length === 0) {
		throw editError(t(locale, 'errors.valueRequired', { field: label }));
	}

	let value = args.join(' ').trim();
	if (field.type === 'number') {
		value = Number(value);
		if (!Number.isFinite(value)) {
			throw editError(t(locale, 'errors.mustBeNumber', { field: label }));
		}
		validateActionPointEdit(character, field.path, value, locale);
	}
	else if (value.toLowerCase() === 'clear') {
		value = '';
	}

	setAtPath(character, field.path, value);
	return t(locale, 'editorResults.updated', { field: label });
}

function parseMultilineEntry(field, line, locale) {
	const label = getCharacterFieldLabel(locale, field.fieldId);
	const value = line.trim();
	if (!value) {
		throw editError(t(locale, 'errors.collectionValueRequired', { field: label }));
	}
	if (!field.rules) {
		return value;
	}

	const separatorIndex = value.indexOf(':');
	const name = (separatorIndex === -1 ? value : value.slice(0, separatorIndex)).trim();
	const remainder = separatorIndex === -1 ? '' : value.slice(separatorIndex + 1).trim();
	if (!name) {
		throw editError(t(locale, 'errors.ruleNameRequired'));
	}
	const levelSeparatorIndex = remainder.indexOf(':');
	const possibleLevel = levelSeparatorIndex === -1
		? remainder
		: remainder.slice(0, levelSeparatorIndex).trim();
	const hasExplicitLevel = /^\d+$/.test(possibleLevel) && levelSeparatorIndex !== -1;
	const level = hasExplicitLevel ? Number(possibleLevel) : 1;
	if (!Number.isSafeInteger(level) || level < 1) {
		throw editError(t(locale, 'errors.ruleLevelInvalid'));
	}
	const description = hasExplicitLevel
		? remainder.slice(levelSeparatorIndex + 1).trim()
		: remainder;
	return { name, description, level };
}

function buildScalarFields() {
	const fields = new Map();
	addScalar(fields, ['firstname'], ['firstName'], 'text');
	addScalar(fields, ['lastname'], ['lastName'], 'text');
	addScalar(fields, ['level'], ['level'], 'number');
	addScalar(fields, ['race.name', 'racename'], ['race', 'name'], 'text');
	addScalar(
		fields,
		['race.description', 'race.physicaldescription', 'racedescription'],
		['race', 'physicalDescription'],
		'text',
	);
	addScalar(fields, ['race.lore', 'racelore'], ['race', 'lore'], 'text');
	addScalar(fields, ['appearance'], ['appearance'], 'text');
	addScalar(fields, ['backstory'], ['backstory'], 'text');
	addScalar(fields, ['goals'], ['goals'], 'text');
	addScalar(
		fields,
		['personality.description', 'personalitydescription'],
		['personality', 'description'],
		'text',
	);
	addScalar(
		fields,
		['racialtrait.skillbonus', 'racialtraits.skillbonus'],
		['racialTraits', 'skillBonus'],
		'text',
	);
	addScalar(
		fields,
		['racialtrait.physicalability', 'racialtraits.physicalability'],
		['racialTraits', 'physicalAbility'],
		'text',
	);
	addScalar(fields, ['talents'], ['talents'], 'text');

	for (const stat of [...BASE_STATS, ...DERIVED_STATS]) {
		addScalar(fields, [`stats.${stat}`, stat], ['stats', stat], 'number');
	}
	for (const resource of ['hp', 'ar', 'ap', 'md']) {
		for (const value of ['current', 'max']) {
			addScalar(
				fields,
				[`${resource}.${value}`, `${value}${resource}`],
				['resources', resource, value],
				'number',
			);
		}
	}
	for (const value of ['current', 'max']) {
		addScalar(
			fields,
			[`encumbrance.${value}`, `encumbrancecapacity.${value}`],
			['encumbrance', value],
			'number',
		);
	}
	return fields;
}

function addScalar(fields, aliases, path, type) {
	for (const alias of aliases) {
		fields.set(normalizeFieldName(alias), {
			fieldId: path.join('.'),
			path,
			type,
		});
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
	return characterEditError(message);
}

module.exports = {
	dealDamage,
	getEditableFieldValue,
	normalizeFieldName,
	resetTurnResources,
	restoreResource,
	setEditableFieldValue,
};

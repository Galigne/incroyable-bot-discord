const {
	characterEditError,
	validateActionPointEdit,
} = require('./mechanics/characterValidation');
const { getEditableFieldDefinition } = require('./characterFieldCatalog');

function getEditableFieldValue(character, fieldName) {
	const field = getEditableFieldDefinition(fieldName);
	if (!field) {
		throw editError('errors.unknownEditField', { field: fieldName });
	}
	if (field.multiline) {
		return getAtPath(character, field.path)
			.map(item => field.rules
				? `${item.name}: ${item.level}: ${item.description}`
				: item)
			.join('\n');
	}
	return String(getAtPath(character, field.path) ?? '');
}

function setEditableFieldValue(character, fieldName, value) {
	const field = getEditableFieldDefinition(fieldName);
	if (!field) {
		throw editError('errors.unknownEditField', { field: fieldName });
	}
	if (field.multiline) {
		const lines = value
			.split(/\r?\n/)
			.map(line => line.trim().replace(/^[-*]\s+/, ''))
			.filter(Boolean);
		const entries = getAtPath(character, field.path);
		entries.splice(
			0,
			entries.length,
			...lines.map(line => parseMultilineEntry(field, line)),
		);
		return {
			translationKey: 'editorResults.collectionUpdated',
			translationVariables: { fieldId: field.id },
		};
	}
	const args = value.trim() ? [value] : ['clear'];
	return editScalar(character, field, args);
}

function editScalar(character, field, args) {
	if (args.length === 0) {
		throw editError('errors.valueRequired', { fieldId: field.id });
	}

	let value = args.join(' ').trim();
	if (field.type === 'number') {
		value = Number(value);
		if (!Number.isFinite(value)) {
			throw editError('errors.mustBeNumber', { fieldId: field.id });
		}
		validateActionPointEdit(character, field.path, value);
	}
	else if (value.toLowerCase() === 'clear') {
		value = '';
	}

	setAtPath(character, field.path, value);
	return {
		translationKey: 'editorResults.updated',
		translationVariables: { fieldId: field.id },
	};
}

function parseMultilineEntry(field, line) {
	const value = line.trim();
	if (!value) {
		throw editError('errors.collectionValueRequired', { fieldId: field.id });
	}
	if (!field.rules) {
		return value;
	}

	const separatorIndex = value.indexOf(':');
	const name = (separatorIndex === -1 ? value : value.slice(0, separatorIndex)).trim();
	const remainder = separatorIndex === -1 ? '' : value.slice(separatorIndex + 1).trim();
	if (!name) {
		throw editError('errors.ruleNameRequired');
	}
	const levelSeparatorIndex = remainder.indexOf(':');
	const possibleLevel = levelSeparatorIndex === -1
		? ''
		: remainder.slice(0, levelSeparatorIndex).trim();
	const level = Number(possibleLevel);
	if (!Number.isSafeInteger(level) || level < 1) {
		throw editError('errors.ruleLevelInvalid');
	}
	const description = remainder.slice(levelSeparatorIndex + 1).trim();
	return { name, description, level };
}

function normalizeFieldName(value = '') {
	return getEditableFieldDefinition(value)?.id
		?? value.toLowerCase().replace(/[^a-z]/g, '');
}

function getAtPath(object, path) {
	return path.reduce((value, key) => value[key], object);
}

function setAtPath(object, path, value) {
	const parent = path.slice(0, -1).reduce((target, key) => target[key], object);
	parent[path.at(-1)] = value;
}

function editError(translationKey, translationVariables) {
	return characterEditError(translationKey, translationVariables);
}

module.exports = {
	getEditableFieldValue,
	normalizeFieldName,
	setEditableFieldValue,
};

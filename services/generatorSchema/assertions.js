const { GENERATOR_ID_PATTERN } = require('./constants');

function validateStableId(id, label) {
	if (
		typeof id !== 'string'
		|| id.length > 100
		|| !GENERATOR_ID_PATTERN.test(id)
	) {
		throw generatorSchemaError(
			'INVALID_GENERATOR_ID',
			`Invalid stable ${label}.`,
		);
	}
}

function validateDisplayText(value, maximumLength, label) {
	if (
		typeof value !== 'string'
		|| !value.trim()
		|| value.length > maximumLength
	) {
		throw generatorSchemaError(
			'INVALID_GENERATOR_TEXT',
			`Invalid localized text for ${label}.`,
		);
	}
}

function validateGeneratorName(value, label) {
	validateDisplayText(value, 256, label);
	if (!/^\p{Lu}/u.test(value)) {
		throw generatorSchemaError(
			'INVALID_GENERATOR_TEXT',
			`Generator name for ${label} must begin with a capital letter.`,
		);
	}
}

function normalizeDisplayName(value) {
	return value
		.normalize('NFKD')
		.replace(/\p{M}/gu, '')
		.toLocaleLowerCase()
		.replace(/[\p{P}\p{S}\s]+/gu, ' ')
		.trim();
}

function assertPlainObject(value, message) {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw generatorSchemaError('INVALID_GENERATOR_STRUCTURE', message);
	}
}

function assertAllowedKeys(value, allowedKeys, message) {
	const allowed = new Set(allowedKeys);
	if (Object.keys(value).some(key => !allowed.has(key))) {
		throw generatorSchemaError('INVALID_GENERATOR_STRUCTURE', message);
	}
}

function assertRequiredKeys(value, requiredKeys, message) {
	if (requiredKeys.some(key => !Object.hasOwn(value, key))) {
		throw generatorSchemaError('INVALID_GENERATOR_STRUCTURE', message);
	}
}

function assertExactKeys(value, expectedKeys, message) {
	const actual = Object.keys(value).sort();
	const expected = [...expectedKeys].sort();
	if (JSON.stringify(actual) !== JSON.stringify(expected)) {
		throw generatorSchemaError('INVALID_GENERATOR_STRUCTURE', message);
	}
}

function generatorSchemaError(code, message) {
	const error = new Error(message);
	error.name = 'GeneratorSchemaError';
	error.code = code;
	return error;
}

module.exports = {
	assertAllowedKeys,
	assertExactKeys,
	assertPlainObject,
	assertRequiredKeys,
	generatorSchemaError,
	normalizeDisplayName,
	validateDisplayText,
	validateGeneratorName,
	validateStableId,
};

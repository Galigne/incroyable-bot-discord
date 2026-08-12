const {
	assertAllowedKeys,
	assertExactKeys,
	assertPlainObject,
	assertRequiredKeys,
	generatorSchemaError,
	validateDisplayText,
	validateTechnicalId,
} = require('./assertions');
const {
	CREATURE_GENERATOR_IDS,
	MAX_ENTRY_TEXT_LENGTH,
	MAX_FIELD_VALUE_LENGTH,
} = require('./constants');
const { validateCreatureGeneration } = require('./creatureMetadataValidation');
const { extractInlineReferences } = require('./referenceValidation');
function validateEntrySchema(entrySchema, file) {
	assertPlainObject(entrySchema, `Generator ${file} has an invalid entrySchema.`);
	if (entrySchema.type === 'text') {
		assertExactKeys(
			entrySchema,
			['type'],
			`Generator ${file} may only define entrySchema.type for this payload.`,
		);
		return entrySchema;
	}
	if (entrySchema.type !== 'fields') {
		throw generatorSchemaError(
			'INVALID_GENERATOR_ENTRY_SCHEMA',
			`Generator ${file} must use a text or fields entry schema.`,
		);
	}
	assertAllowedKeys(
		entrySchema,
		['type', 'required', 'technical'],
		`Generator ${file} has unsupported entrySchema properties.`,
	);
	validateFieldNameList(entrySchema.required, file, 'required');
	if (entrySchema.technical !== undefined) {
		validateFieldNameList(entrySchema.technical, file, 'technical', true);
		const required = new Set(entrySchema.required);
		if (entrySchema.technical.some(field => !required.has(field))) {
			throw generatorSchemaError(
				'INVALID_GENERATOR_ENTRY_SCHEMA',
				`Generator ${file} declares an unknown technical field.`,
			);
		}
	}
	return entrySchema;
}

function validateFieldNameList(fields, file, property, allowEmpty = false) {
	if (
		!Array.isArray(fields)
		|| (!allowEmpty && fields.length === 0)
		|| fields.length > 25
		|| new Set(fields).size !== fields.length
		|| fields.some(field => (
			typeof field !== 'string'
			|| !field.trim()
			|| field.length > 100
			|| !/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(field)
		))
	) {
		throw generatorSchemaError(
			'INVALID_GENERATOR_ENTRY_SCHEMA',
			`Generator ${file} has an invalid ${property} field list.`,
		);
	}
}

function validateGeneratorEntry(entry, entrySchema, generator, file, index) {
	const location = `${file} entry ${index + 1}`;
	assertPlainObject(entry, `Invalid generator entry: ${location}.`);
	validateInlineStrings(entry, location);
	validateTechnicalId(entry.id, `entry ID at ${location}`);
	if (
		entry.weight !== undefined
		&& (!Number.isFinite(entry.weight) || entry.weight <= 0)
	) {
		throw generatorSchemaError(
			'INVALID_GENERATOR_ENTRY_WEIGHT',
			`Generator ${location} has an invalid weight.`,
		);
	}
	const commonKeys = [
		'id',
		'weight',
		...(CREATURE_GENERATOR_IDS.has(generator.id) ? ['generation'] : []),
	];
	if (entrySchema.type === 'text') {
		assertAllowedKeys(
			entry,
			[...commonKeys, 'value'],
			`Generator ${location} has unsupported properties.`,
		);
		assertRequiredKeys(
			entry,
			['id', 'value'],
			`Generator ${location} must contain one text value.`,
		);
		validateDisplayText(entry.value, MAX_ENTRY_TEXT_LENGTH, location);
		return;
	}
	assertAllowedKeys(
		entry,
		[...commonKeys, 'fields'],
		`Generator ${location} has unsupported properties.`,
	);
	assertRequiredKeys(
		entry,
		['id', 'fields'],
		`Generator ${location} must contain one fields object.`,
	);
	assertPlainObject(entry.fields, `Generator ${location} has invalid fields.`);
	assertExactKeys(
		entry.fields,
		entrySchema.required,
		`Generator ${location} does not match its required field schema.`,
	);
	const technicalFields = new Set(entrySchema.technical ?? []);
	for (const [field, value] of Object.entries(entry.fields)) {
		if (
			!['string', 'number', 'boolean'].includes(typeof value)
			|| !String(value).trim()
			|| String(value).length > MAX_FIELD_VALUE_LENGTH
		) {
			throw generatorSchemaError(
				'INVALID_GENERATOR_FIELD_VALUE',
				`Generator ${location} has an invalid ${field} value.`,
			);
		}
		if (typeof value !== 'string' && !technicalFields.has(field)) {
			throw generatorSchemaError(
				'INVALID_GENERATOR_ENTRY_SCHEMA',
				`Generator ${location} must declare non-text field ${field} as technical.`,
			);
		}
	}
	if (CREATURE_GENERATOR_IDS.has(generator.id)) {
		validateCreatureGeneration(entry.generation, location);
	}
}

function validateInlineStrings(value, location) {
	if (typeof value === 'string') {
		extractInlineReferences(value, location);
		return;
	}
	if (Array.isArray(value)) {
		value.forEach((nestedValue, index) => {
			validateInlineStrings(nestedValue, `${location}.${index}`);
		});
		return;
	}
	if (value && typeof value === 'object') {
		for (const [key, nestedValue] of Object.entries(value)) {
			validateInlineStrings(nestedValue, `${location}.${key}`);
		}
	}
}

module.exports = {
	validateEntrySchema,
	validateGeneratorEntry,
};

const {
	assertAllowedKeys,
	assertExactKeys,
	assertPlainObject,
	assertRequiredKeys,
	generatorSchemaError,
	validateDisplayText,
	validateStableId,
} = require('./assertions');
const {
	MAX_ADDITIONAL_ENTRY_FIELDS,
	MAX_ENTRY_NAME_LENGTH,
	MAX_FIELD_VALUE_LENGTH,
} = require('./constants');
const {
	isBackgroundArchetypeGenerator,
	validateBackgroundGeneration,
} = require('./backgroundMetadataValidation');
const {
	isCreatureDetailGenerator,
	validateCreatureGeneration,
} = require('./creatureMetadataValidation');
const { extractInlineReferences } = require('./referenceValidation');
function validateEntrySchema(entrySchema, file) {
	assertPlainObject(entrySchema, `Generator ${file} has an invalid entrySchema.`);
	assertExactKeys(
		entrySchema,
		['required'],
		`Generator ${file} entrySchema must contain only required.`,
	);
	validateFieldNameList(entrySchema.required, file, 'required', true);
	if (entrySchema.required.some(field => (
		['name', 'generator', 'generation'].includes(field)
	))) {
		throw generatorSchemaError(
			'INVALID_GENERATOR_ENTRY_SCHEMA',
			`Generator ${file} must keep name and functional metadata outside fields.`,
		);
	}
	return entrySchema;
}

function validateFieldNameList(fields, file, property, allowEmpty = false) {
	if (
		!Array.isArray(fields)
		|| (!allowEmpty && fields.length === 0)
		|| fields.length > MAX_ADDITIONAL_ENTRY_FIELDS
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

function validateGeneratorEntry(
	entry,
	entrySchema,
	generator,
	file,
	index,
	options = {},
) {
	const location = `${file} entry ${index + 1}`;
	assertPlainObject(entry, `Invalid generator entry: ${location}.`);
	validateInlineStrings(entry, location);
	validateStableId(entry.id, `entry ID at ${location}`);
	if (
		entry.weight !== undefined
		&& (!Number.isFinite(entry.weight) || entry.weight <= 0)
	) {
		throw generatorSchemaError(
			'INVALID_GENERATOR_ENTRY_WEIGHT',
			`Generator ${location} has an invalid weight.`,
		);
	}
	const commonKeys = options.isRouter ? [
		'id',
		'name',
		'weight',
		'generator',
	] : [
		'id',
		'name',
		'weight',
		...(
			isBackgroundArchetypeGenerator(generator.id, options)
			|| isCreatureDetailGenerator(generator.id, options)
				? ['generation']
				: []
		),
	];
	if (options.isRouter) {
		validateStableId(entry.generator, `structural route at ${location}`);
	}
	assertRequiredKeys(
		entry,
		['id', 'name'],
		`Generator ${location} must contain an ID and localized name.`,
	);
	validateDisplayText(entry.name, MAX_ENTRY_NAME_LENGTH, `${location} name`);
	if (options.isRouter || entrySchema.required.length === 0) {
		assertAllowedKeys(
			entry,
			commonKeys,
			`Generator ${location} has unsupported properties.`,
		);
		if (
			entry.generation !== undefined
			&& isCreatureDetailGenerator(generator.id, options)
		) {
			validateCreatureGeneration(entry.generation, location);
		}
		if (
			entry.generation !== undefined
			&& isBackgroundArchetypeGenerator(generator.id, options)
		) {
			validateBackgroundGeneration(entry.generation, location);
		}
		return;
	}
	assertAllowedKeys(
		entry,
		[...commonKeys, 'fields'],
		`Generator ${location} has unsupported properties.`,
	);
	assertRequiredKeys(
		entry,
		['id', 'name', 'fields'],
		`Generator ${location} must contain its declared additional fields.`,
	);
	assertPlainObject(entry.fields, `Generator ${location} has invalid fields.`);
	assertExactKeys(
		entry.fields,
		entrySchema.required,
		`Generator ${location} does not match its required field schema.`,
	);
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
	}
	if (
		entry.generation !== undefined
		&& isCreatureDetailGenerator(generator.id, options)
	) {
		validateCreatureGeneration(entry.generation, location);
	}
	if (
		entry.generation !== undefined
		&& isBackgroundArchetypeGenerator(generator.id, options)
	) {
		validateBackgroundGeneration(entry.generation, location);
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

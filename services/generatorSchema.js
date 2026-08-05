const GENERATOR_SCHEMA_VERSION = 2;
const GENERATOR_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const GENERATOR_KINDS = new Set(['category', 'component']);
const GENERATOR_VISIBILITIES = new Set(['internal', 'public']);
const MAX_ENTRY_TEXT_LENGTH = 4_096;
const MAX_FIELD_VALUE_LENGTH = 1_024;

function validateGeneratorDefinition(generator, file = '<generator>') {
	assertPlainObject(generator, `Invalid generator document: ${file}.`);
	assertExactKeys(
		generator,
		[
			'schemaVersion',
			'id',
			'kind',
			'visibility',
			'name',
			'description',
			'entrySchema',
			'entries',
		],
		`Invalid generator envelope: ${file}.`,
	);
	if (generator.schemaVersion !== GENERATOR_SCHEMA_VERSION) {
		throw generatorSchemaError(
			'INVALID_GENERATOR_SCHEMA_VERSION',
			`Generator ${file} must use schemaVersion ${GENERATOR_SCHEMA_VERSION}.`,
		);
	}
	validateTechnicalId(generator.id, `generator ID in ${file}`);
	if (!GENERATOR_KINDS.has(generator.kind)) {
		throw generatorSchemaError(
			'INVALID_GENERATOR_KIND',
			`Generator ${file} has an unsupported kind.`,
		);
	}
	if (!GENERATOR_VISIBILITIES.has(generator.visibility)) {
		throw generatorSchemaError(
			'INVALID_GENERATOR_VISIBILITY',
			`Generator ${file} has an unsupported visibility.`,
		);
	}
	validateDisplayText(generator.name, 256, `generator name in ${file}`);
	validateDisplayText(generator.description, MAX_ENTRY_TEXT_LENGTH, `generator description in ${file}`);
	const entrySchema = validateEntrySchema(generator.entrySchema, file);
	if (!Array.isArray(generator.entries) || generator.entries.length === 0) {
		throw generatorSchemaError(
			'INVALID_GENERATOR_ENTRIES',
			`Generator ${file} must contain at least one entry.`,
		);
	}

	const entryIds = new Set();
	generator.entries.forEach((entry, index) => {
		validateGeneratorEntry(entry, entrySchema, file, index);
		if (entryIds.has(entry.id)) {
			throw generatorSchemaError(
				'DUPLICATE_GENERATOR_ENTRY_ID',
				`Generator ${file} contains duplicate entry ID ${entry.id}.`,
			);
		}
		entryIds.add(entry.id);
	});
	const totalWeight = generator.entries.reduce(
		(total, entry) => total + (entry.weight ?? 1),
		0,
	);
	if (!Number.isFinite(totalWeight)) {
		throw generatorSchemaError(
			'INVALID_GENERATOR_TOTAL_WEIGHT',
			`Generator ${file} has a non-finite total weight.`,
		);
	}
	return generator;
}

function validateGeneratorPair(english, french, file = '<generator>') {
	validateGeneratorDefinition(english, `en/${file}`);
	validateGeneratorDefinition(french, `fr/${file}`);
	for (const property of [
		'schemaVersion',
		'id',
		'kind',
		'visibility',
	]) {
		assertParity(english[property], french[property], file, property);
	}
	assertParity(english.entrySchema, french.entrySchema, file, 'entrySchema');
	assertParity(english.entries.length, french.entries.length, file, 'entries.length');

	const technicalFields = new Set(english.entrySchema.technical ?? []);
	for (let index = 0; index < english.entries.length; index += 1) {
		const englishEntry = english.entries[index];
		const frenchEntry = french.entries[index];
		assertParity(
			Object.keys(englishEntry),
			Object.keys(frenchEntry),
			file,
			`entries.${index}.keys`,
		);
		assertParity(englishEntry.id, frenchEntry.id, file, `entries.${index}.id`);
		assertParity(
			Object.hasOwn(englishEntry, 'weight'),
			Object.hasOwn(frenchEntry, 'weight'),
			file,
			`entries.${index}.weight.presence`,
		);
		if (Object.hasOwn(englishEntry, 'weight')) {
			assertParity(
				englishEntry.weight,
				frenchEntry.weight,
				file,
				`entries.${index}.weight`,
			);
		}
		if (english.entrySchema.type === 'fields') {
			assertParity(
				Object.keys(englishEntry.fields),
				Object.keys(frenchEntry.fields),
				file,
				`entries.${index}.fields`,
			);
			for (const field of english.entrySchema.required) {
				const location = `entries.${index}.fields.${field}`;
				assertParity(
					typeof englishEntry.fields[field],
					typeof frenchEntry.fields[field],
					file,
					`${location}.type`,
				);
				if (technicalFields.has(field)) {
					assertParity(
						englishEntry.fields[field],
						frenchEntry.fields[field],
						file,
						location,
					);
				}
				else if (typeof englishEntry.fields[field] === 'string') {
					assertParity(
						extractPlaceholders(englishEntry.fields[field]),
						extractPlaceholders(frenchEntry.fields[field]),
						file,
						`${location}.placeholders`,
					);
				}
			}
		}
		else {
			assertParity(
				extractPlaceholders(englishEntry.value),
				extractPlaceholders(frenchEntry.value),
				file,
				`entries.${index}.value.placeholders`,
			);
		}
	}
	return true;
}

function validateEntrySchema(entrySchema, file) {
	assertPlainObject(entrySchema, `Generator ${file} has an invalid entrySchema.`);
	if (entrySchema.type === 'text') {
		assertExactKeys(
			entrySchema,
			['type'],
			`Text generator ${file} may only define entrySchema.type.`,
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
			|| field.length > 256
		))
	) {
		throw generatorSchemaError(
			'INVALID_GENERATOR_ENTRY_SCHEMA',
			`Generator ${file} has an invalid ${property} field list.`,
		);
	}
}

function validateGeneratorEntry(entry, entrySchema, file, index) {
	const location = `${file} entry ${index + 1}`;
	assertPlainObject(entry, `Invalid generator entry: ${location}.`);
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

	const commonKeys = ['id', 'weight'];
	if (entrySchema.type === 'text') {
		assertAllowedKeys(entry, [...commonKeys, 'value'], `Generator ${location} has unsupported properties.`);
		if (!Object.hasOwn(entry, 'value') || Object.hasOwn(entry, 'fields')) {
			throw generatorSchemaError(
				'INVALID_GENERATOR_ENTRY_PAYLOAD',
				`Generator ${location} must contain one text value.`,
			);
		}
		validateDisplayText(entry.value, MAX_ENTRY_TEXT_LENGTH, location);
		return;
	}

	assertAllowedKeys(entry, [...commonKeys, 'fields'], `Generator ${location} has unsupported properties.`);
	if (!Object.hasOwn(entry, 'fields') || Object.hasOwn(entry, 'value')) {
		throw generatorSchemaError(
			'INVALID_GENERATOR_ENTRY_PAYLOAD',
			`Generator ${location} must contain one fields object.`,
		);
	}
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
}

function validateTechnicalId(id, label) {
	if (
		typeof id !== 'string'
		|| id.length > 100
		|| !GENERATOR_ID_PATTERN.test(id)
	) {
		throw generatorSchemaError(
			'INVALID_GENERATOR_ID',
			`Invalid stable technical ${label}.`,
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

function assertExactKeys(value, expectedKeys, message) {
	if (JSON.stringify(Object.keys(value)) !== JSON.stringify(expectedKeys)) {
		throw generatorSchemaError('INVALID_GENERATOR_STRUCTURE', message);
	}
}

function assertParity(english, french, file, property) {
	if (JSON.stringify(english) !== JSON.stringify(french)) {
		throw generatorSchemaError(
			'GENERATOR_LOCALE_PARITY_MISMATCH',
			`English and French generator data differ at ${file}:${property}.`,
		);
	}
}

function extractPlaceholders(value) {
	return [
		...value.matchAll(/\{\{[^{}]+\}\}|\$\{[^{}]+\}|%\w/g),
	].map(match => match[0]).sort();
}

function generatorSchemaError(code, message) {
	const error = new Error(message);
	error.name = 'GeneratorSchemaError';
	error.code = code;
	return error;
}

module.exports = {
	GENERATOR_SCHEMA_VERSION,
	validateGeneratorDefinition,
	validateGeneratorPair,
};

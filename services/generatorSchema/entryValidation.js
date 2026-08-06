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
const {
	validateModifierEntrySchema,
	validateModifierRequests,
} = require('./modifierValidation');
const {
	extractTemplateMarkers,
	validateReference,
} = require('./referenceValidation');

function validateEntrySchema(entrySchema, generatorKind, file) {
	assertPlainObject(entrySchema, `Generator ${file} has an invalid entrySchema.`);
	if (entrySchema.type === 'text' || entrySchema.type === 'template') {
		assertExactKeys(
			entrySchema,
			['type'],
			`Generator ${file} may only define entrySchema.type for this payload.`,
		);
		if (
			generatorKind === 'modifier'
			|| (generatorKind === 'template') !== (entrySchema.type === 'template')
		) {
			throw generatorSchemaError(
				'INVALID_GENERATOR_ENTRY_SCHEMA',
				`Generator ${file} has a kind and entry schema mismatch.`,
			);
		}
		return entrySchema;
	}
	if (entrySchema.type !== 'fields' || generatorKind === 'template') {
		throw generatorSchemaError(
			'INVALID_GENERATOR_ENTRY_SCHEMA',
			`Generator ${file} must use a text, fields, or template entry schema.`,
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
	if (generatorKind === 'modifier') {
		validateModifierEntrySchema(entrySchema, file);
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

function validateGeneratorEntry(entry, entrySchema, generator, file, index) {
	const location = `${file} entry ${index + 1}`;
	const generatorKind = generator.kind;
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
	if (entry.modifiers !== undefined) {
		if (generatorKind === 'modifier') {
			throw generatorSchemaError(
				'INVALID_MODIFIER_REQUEST',
				`Modifier entry ${location} cannot request other modifiers.`,
			);
		}
		validateModifierRequests(entry.modifiers, `${location} modifiers`);
	}

	const commonKeys = [
		'id',
		'weight',
		'modifiers',
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
	if (entrySchema.type === 'template') {
		validateTemplateEntry(entry, commonKeys, location);
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

function validateTemplateEntry(entry, commonKeys, location) {
	assertAllowedKeys(
		entry,
		[...commonKeys, 'template', 'references'],
		`Generator ${location} has unsupported properties.`,
	);
	assertRequiredKeys(
		entry,
		['id', 'template', 'references'],
		`Generator ${location} must contain a template and references.`,
	);
	validateDisplayText(entry.template, MAX_ENTRY_TEXT_LENGTH, `${location} template`);
	assertPlainObject(entry.references, `Generator ${location} has invalid references.`);
	const referenceNames = Object.keys(entry.references);
	if (referenceNames.length === 0 || referenceNames.length > 25) {
		throw generatorSchemaError(
			'INVALID_GENERATOR_REFERENCES',
			`Generator ${location} must contain 1 to 25 references.`,
		);
	}
	for (const [name, reference] of Object.entries(entry.references)) {
		validateTechnicalId(name, `reference name in ${location}`);
		validateReference(reference, `${location} reference ${name}`);
	}
	const markers = extractTemplateMarkers(entry.template, location);
	if (JSON.stringify([...new Set(markers)].sort()) !== JSON.stringify(referenceNames.sort())) {
		throw generatorSchemaError(
			'GENERATOR_TEMPLATE_REFERENCE_MISMATCH',
			`Generator ${location} template markers and references must match.`,
		);
	}
}

module.exports = {
	validateEntrySchema,
	validateGeneratorEntry,
};

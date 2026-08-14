const {
	assertAllowedKeys,
	assertPlainObject,
	assertRequiredKeys,
	generatorSchemaError,
	validateDisplayText,
	validateGeneratorName,
	validateStableId,
} = require('./assertions');
const {
	GENERATOR_SCHEMA_VERSION,
	GENERATOR_VISIBILITIES,
	MAX_ENTRY_TEXT_LENGTH,
} = require('./constants');
const { validateCreatureGeneratorEnvelope } = require('./creatureMetadataValidation');
const {
	validateEntrySchema,
	validateGeneratorEntry,
} = require('./entryValidation');
const { extractInlineReferences } = require('./referenceValidation');
const { validateModifierMap } = require('./modifierMapValidation');

function validateGeneratorDefinition(generator, file = '<generator>', options = {}) {
	assertPlainObject(generator, `Invalid generator document: ${file}.`);
	assertAllowedKeys(
		generator,
		[
			'schemaVersion',
			'id',
			'visibility',
			'name',
			'description',
			'entrySchema',
			'modifiers',
			'entries',
		],
		`Invalid generator envelope: ${file}.`,
	);
	assertRequiredKeys(
		generator,
		[
			'schemaVersion',
			'id',
			'visibility',
			'name',
			'description',
			'entrySchema',
			'entries',
		],
		`Generator ${file} is missing a required envelope property.`,
	);
	if (generator.schemaVersion !== GENERATOR_SCHEMA_VERSION) {
		throw generatorSchemaError(
			'INVALID_GENERATOR_SCHEMA_VERSION',
			`Generator ${file} must use schemaVersion ${GENERATOR_SCHEMA_VERSION}.`,
		);
	}
	validateStableId(generator.id, `generator ID in ${file}`);
	if (!GENERATOR_VISIBILITIES.has(generator.visibility)) {
		throw generatorSchemaError(
			'INVALID_GENERATOR_VISIBILITY',
			`Generator ${file} has an unsupported visibility.`,
		);
	}
	validateGeneratorName(generator.name, `generator name in ${file}`);
	extractInlineReferences(generator.name, `generator name in ${file}`);
	validateDisplayText(
		generator.description,
		MAX_ENTRY_TEXT_LENGTH,
		`generator description in ${file}`,
	);
	extractInlineReferences(generator.description, `generator description in ${file}`);
	const entrySchema = validateEntrySchema(generator.entrySchema, file);
	validateCreatureGeneratorEnvelope(generator, entrySchema, file, options);
	if (generator.modifiers !== undefined) {
		validateModifierMap(generator.modifiers, `${file} modifiers`);
	}
	if (!Array.isArray(generator.entries) || generator.entries.length === 0) {
		throw generatorSchemaError(
			'INVALID_GENERATOR_ENTRIES',
			`Generator ${file} must contain at least one entry.`,
		);
	}

	const entryIds = new Set();
	generator.entries.forEach((entry, index) => {
		validateGeneratorEntry(entry, entrySchema, generator, file, index, options);
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

module.exports = { validateGeneratorDefinition };

const {
	assertAllowedKeys,
	assertPlainObject,
	assertRequiredKeys,
	generatorSchemaError,
	validateDisplayText,
	validateTechnicalId,
} = require('./assertions');
const {
	GENERATOR_KINDS,
	GENERATOR_SCHEMA_VERSION,
	GENERATOR_VISIBILITIES,
	MAX_ENTRY_TEXT_LENGTH,
} = require('./constants');
const { validateCreatureGeneratorEnvelope } = require('./creatureMetadataValidation');
const {
	validateEntrySchema,
	validateGeneratorEntry,
} = require('./entryValidation');
const {
	validateModifierRequests,
	validateTechnicalIdList,
} = require('./modifierValidation');

function validateGeneratorDefinition(generator, file = '<generator>') {
	assertPlainObject(generator, `Invalid generator document: ${file}.`);
	assertAllowedKeys(
		generator,
		[
			'schemaVersion',
			'id',
			'kind',
			'visibility',
			'name',
			'description',
			'appliesTo',
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
			'kind',
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
	validateDisplayText(
		generator.description,
		MAX_ENTRY_TEXT_LENGTH,
		`generator description in ${file}`,
	);
	validateGeneratorKindProperties(generator, file);
	const entrySchema = validateEntrySchema(generator.entrySchema, generator.kind, file);
	validateCreatureGeneratorEnvelope(generator, entrySchema, file);
	if (generator.modifiers !== undefined) {
		validateModifierRequests(generator.modifiers, `${file} modifiers`);
	}
	if (!Array.isArray(generator.entries) || generator.entries.length === 0) {
		throw generatorSchemaError(
			'INVALID_GENERATOR_ENTRIES',
			`Generator ${file} must contain at least one entry.`,
		);
	}

	const entryIds = new Set();
	generator.entries.forEach((entry, index) => {
		validateGeneratorEntry(entry, entrySchema, generator, file, index);
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

function validateGeneratorKindProperties(generator, file) {
	if (generator.kind === 'modifier') {
		if (generator.visibility !== 'internal') {
			throw generatorSchemaError(
				'INVALID_MODIFIER_VISIBILITY',
				`Modifier generator ${file} must be internal.`,
			);
		}
		validateTechnicalIdList(generator.appliesTo, file, 'appliesTo');
		if (generator.modifiers !== undefined) {
			throw generatorSchemaError(
				'INVALID_MODIFIER_REQUEST',
				`Modifier generator ${file} cannot request other modifiers.`,
			);
		}
		return;
	}
	if (generator.appliesTo !== undefined) {
		throw generatorSchemaError(
			'INVALID_MODIFIER_COMPATIBILITY',
			`Non-modifier generator ${file} cannot define appliesTo.`,
		);
	}
}

module.exports = { validateGeneratorDefinition };

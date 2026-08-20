const {
	assertAllowedKeys,
	assertPlainObject,
	assertRequiredKeys,
	generatorSchemaError,
	normalizeDisplayName,
	validateDisplayText,
	validateGeneratorName,
	validateStableId,
} = require('./assertions');
const {
	GENERATOR_SCHEMA_VERSION,
	GENERATOR_VISIBILITIES,
	MAX_ENTRY_TEXT_LENGTH,
} = require('./constants');
const {
	validateRoutedArchetypeGeneratorEnvelope,
} = require('./routedArchetypeValidation');
const {
	validateEntrySchema,
	validateGeneratorEntry,
} = require('./entryValidation');
const { extractInlineReferences } = require('./referenceValidation');
const { validateModifierMap } = require('./modifierMapValidation');
const {
	validateGeneratorRouterStructure,
} = require('./routerValidation');

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
	if (generator.modifiers !== undefined) {
		validateModifierMap(generator.modifiers, `${file} modifiers`);
	}
	if (!Array.isArray(generator.entries) || generator.entries.length === 0) {
		throw generatorSchemaError(
			'INVALID_GENERATOR_ENTRIES',
			`Generator ${file} must contain at least one entry.`,
		);
	}
	const isRouter = validateGeneratorRouterStructure(generator, file);
	validateRoutedArchetypeGeneratorEnvelope(
		generator,
		entrySchema,
		file,
		{ ...options, isRouter },
	);

	const entryIds = new Set();
	const entryNames = new Set();
	generator.entries.forEach((entry, index) => {
		validateGeneratorEntry(
			entry,
			entrySchema,
			generator,
			file,
			index,
			{ ...options, isRouter },
		);
		if (entryIds.has(entry.id)) {
			throw generatorSchemaError(
				'DUPLICATE_GENERATOR_ENTRY_ID',
				`Generator ${file} contains duplicate entry ID ${entry.id}.`,
			);
		}
		entryIds.add(entry.id);
		const normalizedName = normalizeDisplayName(entry.name);
		if (!normalizedName) {
			throw generatorSchemaError(
				'INVALID_GENERATOR_TEXT',
				`Generator ${file} entry ${entry.id} must have a readable name.`,
			);
		}
		if (entryNames.has(normalizedName)) {
			throw generatorSchemaError(
				'DUPLICATE_GENERATOR_ENTRY_NAME',
				`Generator ${file} contains ambiguous entry name ${entry.name}.`,
			);
		}
		entryNames.add(normalizedName);
	});
	validateEntryAliasIdCollisions(generator, file);
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

function validateEntryAliasIdCollisions(generator, file) {
	const stableIds = new Map(generator.entries.map(entry => [
		normalizeDisplayName(entry.id),
		entry.id,
	]));
	for (const entry of generator.entries) {
		const conflictingId = stableIds.get(normalizeDisplayName(entry.name));
		if (conflictingId && conflictingId !== entry.id) {
			throw generatorSchemaError(
				'AMBIGUOUS_GENERATOR_ENTRY_ALIAS',
				`Generator ${file} entry ${entry.id} has an alias that conflicts with stable ID ${conflictingId}.`,
			);
		}
	}
}

module.exports = { validateGeneratorDefinition };

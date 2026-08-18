const { generatorSchemaError } = require('./assertions');
const { BACKGROUND_ROUTER_ID } = require('./constants');
const { validateGenerationMetadata } = require('./generationMetadataValidation');

function validateBackgroundGeneratorEnvelope(
	generator,
	entrySchema,
	file,
	options = {},
) {
	if (generator.id === BACKGROUND_ROUTER_ID) {
		if (generator.visibility !== 'public' || !options.isRouter) {
			throw generatorSchemaError(
				'INVALID_BACKGROUND_ROUTER_SCHEMA',
				`Background router ${file} must be a public structural router.`,
			);
		}
		return;
	}
	if (!isBackgroundArchetypeGenerator(generator.id, options)) {
		return;
	}
	if (
		generator.visibility !== 'internal'
		|| options.isRouter
		|| entrySchema.required.length !== 0
	) {
		throw generatorSchemaError(
			'INVALID_BACKGROUND_ARCHETYPE_SCHEMA',
			`Background archetype generator ${file} must be internal and name-only.`,
		);
	}
}

function isBackgroundArchetypeGenerator(generatorId, options = {}) {
	return options.backgroundGeneratorIds instanceof Set
		&& options.backgroundGeneratorIds.has(generatorId);
}

function validateBackgroundGeneration(generation, location) {
	validateGenerationMetadata(generation, location, 'character');
}

module.exports = {
	isBackgroundArchetypeGenerator,
	validateBackgroundGeneration,
	validateBackgroundGeneratorEnvelope,
};

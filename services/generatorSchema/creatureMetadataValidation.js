const { generatorSchemaError } = require('./assertions');
const { CREATURE_ROUTER_ID } = require('./constants');
const { validateGenerationMetadata } = require('./generationMetadataValidation');

function validateCreatureGeneratorEnvelope(
	generator,
	entrySchema,
	file,
	options = {},
) {
	if (generator.id === CREATURE_ROUTER_ID) {
		if (
			generator.visibility !== 'public'
			|| !options.isRouter
		) {
			throw generatorSchemaError(
				'INVALID_CREATURE_ROUTER_SCHEMA',
				`Creature router ${file} must be a public structural router.`,
			);
		}
		return;
	}
	if (!isCreatureDetailGenerator(generator.id, options)) {
		return;
	}
	if (
		generator.visibility !== 'internal'
		|| options.isRouter
		|| JSON.stringify(entrySchema.required) !== JSON.stringify(['description'])
	) {
		throw generatorSchemaError(
			'INVALID_CREATURE_ARCHETYPE_SCHEMA',
			`Creature detail generator ${file} must be internal with localized names and description fields.`,
		);
	}
}

function isCreatureDetailGenerator(generatorId, options = {}) {
	return options.creatureGeneratorIds instanceof Set
		&& options.creatureGeneratorIds.has(generatorId);
}

function validateCreatureGeneration(generation, location) {
	validateGenerationMetadata(generation, location, 'creature');
}

module.exports = {
	isCreatureDetailGenerator,
	validateCreatureGeneration,
	validateCreatureGeneratorEnvelope,
};

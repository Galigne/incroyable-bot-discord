const {
	CREATURE_ROUTED_ARCHETYPE,
	isRoutedArchetypeGenerator,
	validateRoutedArchetypeGeneration,
	validateRoutedArchetypeGeneratorEnvelope,
} = require('./routedArchetypeValidation');

function validateCreatureGeneratorEnvelope(
	generator,
	entrySchema,
	file,
	options = {},
) {
	validateRoutedArchetypeGeneratorEnvelope(
		generator,
		entrySchema,
		file,
		options,
		CREATURE_ROUTED_ARCHETYPE,
	);
}

function isCreatureDetailGenerator(generatorId, options = {}) {
	return isRoutedArchetypeGenerator(
		generatorId,
		options,
		CREATURE_ROUTED_ARCHETYPE,
	);
}

function validateCreatureGeneration(generation, location) {
	validateRoutedArchetypeGeneration(
		generation,
		location,
		CREATURE_ROUTED_ARCHETYPE,
	);
}

module.exports = {
	isCreatureDetailGenerator,
	validateCreatureGeneration,
	validateCreatureGeneratorEnvelope,
};

const {
	BACKGROUND_ROUTED_ARCHETYPE,
	isRoutedArchetypeGenerator,
	validateRoutedArchetypeGeneration,
	validateRoutedArchetypeGeneratorEnvelope,
} = require('./routedArchetypeValidation');

function validateBackgroundGeneratorEnvelope(
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
		BACKGROUND_ROUTED_ARCHETYPE,
	);
}

function isBackgroundArchetypeGenerator(generatorId, options = {}) {
	return isRoutedArchetypeGenerator(
		generatorId,
		options,
		BACKGROUND_ROUTED_ARCHETYPE,
	);
}

function validateBackgroundGeneration(generation, location) {
	validateRoutedArchetypeGeneration(
		generation,
		location,
		BACKGROUND_ROUTED_ARCHETYPE,
	);
}

module.exports = {
	isBackgroundArchetypeGenerator,
	validateBackgroundGeneration,
	validateBackgroundGeneratorEnvelope,
};

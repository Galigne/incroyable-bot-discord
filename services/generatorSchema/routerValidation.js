const {
	assertAllowedKeys,
	generatorSchemaError,
} = require('./assertions');

function hasStructuralGeneratorRoute(entry) {
	return Object.hasOwn(entry ?? {}, 'generator');
}

function isGeneratorRouter(generator) {
	return Array.isArray(generator?.entries)
		&& generator.entries.length > 0
		&& generator.entries.every(hasStructuralGeneratorRoute);
}

function validateGeneratorRouterStructure(generator, file) {
	const routedEntries = generator.entries.filter(hasStructuralGeneratorRoute);
	if (routedEntries.length === 0) {
		return false;
	}
	if (routedEntries.length !== generator.entries.length) {
		throw generatorSchemaError(
			'INVALID_GENERATOR_ROUTER_SCHEMA',
			`Generator ${file} cannot mix routed and content entries.`,
		);
	}
	if (generator.entrySchema.required.length !== 0) {
		throw generatorSchemaError(
			'INVALID_GENERATOR_ROUTER_SCHEMA',
			`Router ${file} must have an empty required field schema.`,
		);
	}
	for (const [index, entry] of generator.entries.entries()) {
		assertAllowedKeys(
			entry,
			['id', 'name', 'weight', 'generator'],
			`Router ${file} entry ${index + 1} has unsupported properties.`,
		);
	}
	return true;
}

module.exports = {
	hasStructuralGeneratorRoute,
	isGeneratorRouter,
	validateGeneratorRouterStructure,
};

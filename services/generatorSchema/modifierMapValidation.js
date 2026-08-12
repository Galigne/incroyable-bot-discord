const {
	assertPlainObject,
	generatorSchemaError,
	validateTechnicalId,
} = require('./assertions');
const { MAX_MODIFIER_SOURCES } = require('./constants');

function validateModifierMap(modifiers, location) {
	assertPlainObject(modifiers, `Generator ${location} must be an object.`);
	const sourceIds = Object.keys(modifiers);
	if (sourceIds.length > MAX_MODIFIER_SOURCES) {
		throw generatorSchemaError(
			'INVALID_MODIFIER_MAP',
			`Generator ${location} may contain at most ${MAX_MODIFIER_SOURCES} modifier sources.`,
		);
	}
	for (const sourceId of sourceIds) {
		validateTechnicalId(sourceId, `modifier generator in ${location}`);
		const percentage = modifiers[sourceId];
		if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
			throw generatorSchemaError(
				'INVALID_MODIFIER_PERCENTAGE',
				`Generator ${location} has an invalid modifier percentage.`,
			);
		}
	}
}

function validateModifierRelationships(generator, catalog) {
	for (const sourceId of Object.keys(generator.modifiers ?? {})) {
		if (!catalog.has(sourceId)) {
			throw generatorSchemaError(
				'GENERATOR_REFERENCE_MISSING',
				`Generator ${generator.id} requests an unknown modifier generator.`,
			);
		}
	}
}

module.exports = {
	validateModifierMap,
	validateModifierRelationships,
};

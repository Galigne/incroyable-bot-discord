const {
	CREATURE_ROUTED_ARCHETYPE,
	validateRoutedArchetypeStatProfileRelationships,
} = require('./routedArchetypeValidation');
const {
	validateGenerationRelationships,
} = require('./generationRelationshipValidation');

function validateCreatureGenerationRelationships(
	generator,
	entry,
	catalog,
	validateReferenceRelationship,
) {
	validateGenerationRelationships(
		generator,
		entry,
		catalog,
		validateReferenceRelationship,
	);
}

function validateCreatureStatProfileRelationships(catalogs, profiles) {
	if (!(catalogs instanceof Map) || !(profiles instanceof Map)) {
		throw new TypeError('Creature profile validation requires catalog and profile maps.');
	}
	return validateRoutedArchetypeStatProfileRelationships(
		catalogs,
		profiles,
		CREATURE_ROUTED_ARCHETYPE,
	);
}

module.exports = {
	validateCreatureGenerationRelationships,
	validateCreatureStatProfileRelationships,
};

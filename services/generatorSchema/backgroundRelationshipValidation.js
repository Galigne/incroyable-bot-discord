const {
	BACKGROUND_ROUTED_ARCHETYPE,
	validateRoutedArchetypeStatProfileRelationships,
} = require('./routedArchetypeValidation');

function validateBackgroundStatProfileRelationships(catalogs, profiles) {
	if (!(catalogs instanceof Map) || !(profiles instanceof Map)) {
		throw new TypeError('Background profile validation requires catalog and profile maps.');
	}
	return validateRoutedArchetypeStatProfileRelationships(
		catalogs,
		profiles,
		BACKGROUND_ROUTED_ARCHETYPE,
	);
}

module.exports = { validateBackgroundStatProfileRelationships };

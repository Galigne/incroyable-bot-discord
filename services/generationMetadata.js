const DEFAULT_STAT_PROFILE_ID = 'default';

const COMMON_GENERATION_PROPERTIES = Object.freeze([
	'statProfile',
	'naturalArmorPercentage',
	'fixedRules',
	'statusEffects',
	'modifiers',
	'armor',
	'equipment',
	'inventory',
]);

const TEMPLATE_PROPERTY_BY_ENTITY_TYPE = Object.freeze({
	character: 'talents',
	creature: 'traits',
});

function getGenerationMetadata(entry) {
	return entry?.generation ?? {};
}

function getGenerationStatProfileId(generation) {
	return generation?.statProfile ?? DEFAULT_STAT_PROFILE_ID;
}

function hasGenerationOverride(generation, property) {
	return Boolean(generation && Object.hasOwn(generation, property));
}

module.exports = {
	COMMON_GENERATION_PROPERTIES,
	DEFAULT_STAT_PROFILE_ID,
	TEMPLATE_PROPERTY_BY_ENTITY_TYPE,
	getGenerationMetadata,
	getGenerationStatProfileId,
	hasGenerationOverride,
};

const GENERATOR_SCHEMA_VERSION = 2;
const GENERATOR_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const GENERATOR_KINDS = new Set(['category', 'component', 'modifier', 'template']);
const GENERATOR_VISIBILITIES = new Set(['internal', 'public']);
const MAX_ENTRY_TEXT_LENGTH = 4_096;
const MAX_FIELD_VALUE_LENGTH = 1_024;
const MAX_MODIFIER_REQUESTS = 25;
const MAX_MODIFIER_COUNT = 25;
const CREATURE_ARCHETYPE_IDS = new Set(['animal', 'companion', 'monster']);
const CREATURE_GENERATOR_BY_ARCHETYPE = Object.freeze(Object.fromEntries(
	[...CREATURE_ARCHETYPE_IDS].map(archetype => [
		archetype,
		`creature-${archetype}`,
	]),
));
const CREATURE_GENERATOR_IDS = new Set(
	Object.values(CREATURE_GENERATOR_BY_ARCHETYPE),
);
const CREATURE_ROUTER_ID = 'creature';
const FORBIDDEN_MODIFIER_FIELDS = new Set([
	'armor',
	'behavior',
	'derived statistics',
	'effects',
	'entity type',
	'equipment',
	'inventory',
	'mechanics',
	'resources',
	'rules',
	'statistics',
	'status effects',
	'traits',
]);

module.exports = {
	CREATURE_ARCHETYPE_IDS,
	CREATURE_GENERATOR_BY_ARCHETYPE,
	CREATURE_GENERATOR_IDS,
	CREATURE_ROUTER_ID,
	FORBIDDEN_MODIFIER_FIELDS,
	GENERATOR_ID_PATTERN,
	GENERATOR_KINDS,
	GENERATOR_SCHEMA_VERSION,
	GENERATOR_VISIBILITIES,
	MAX_ENTRY_TEXT_LENGTH,
	MAX_FIELD_VALUE_LENGTH,
	MAX_MODIFIER_COUNT,
	MAX_MODIFIER_REQUESTS,
};

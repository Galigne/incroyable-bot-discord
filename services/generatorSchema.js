const {
	CREATURE_ARCHETYPE_IDS,
	CREATURE_GENERATOR_BY_ARCHETYPE,
	CREATURE_GENERATOR_IDS,
	CREATURE_ROUTER_ID,
	GENERATOR_SCHEMA_VERSION,
} = require('./generatorSchema/constants');
const {
	validateCreatureStatProfileRelationships,
} = require('./generatorSchema/creatureRelationshipValidation');
const {
	validateGeneratorDefinition,
} = require('./generatorSchema/envelopeValidation');
const {
	validateGeneratorPair,
} = require('./generatorSchema/parityValidation');
const {
	validateGeneratorRelationships,
} = require('./generatorSchema/relationshipValidation');

module.exports = {
	CREATURE_ARCHETYPE_IDS: Object.freeze([...CREATURE_ARCHETYPE_IDS]),
	CREATURE_GENERATOR_BY_ARCHETYPE,
	CREATURE_GENERATOR_IDS: Object.freeze([...CREATURE_GENERATOR_IDS]),
	CREATURE_ROUTER_ID,
	GENERATOR_SCHEMA_VERSION,
	validateCreatureStatProfileRelationships,
	validateGeneratorDefinition,
	validateGeneratorPair,
	validateGeneratorRelationships,
};

const {
	BACKGROUND_ROUTER_ID,
	CREATURE_ROUTER_ID,
	GENERATOR_SCHEMA_VERSION,
} = require('./generatorSchema/constants');
const {
	validateBackgroundStatProfileRelationships,
} = require('./generatorSchema/backgroundRelationshipValidation');
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
const {
	isGeneratorRouter,
} = require('./generatorSchema/routerValidation');

module.exports = {
	BACKGROUND_ROUTER_ID,
	CREATURE_ROUTER_ID,
	GENERATOR_SCHEMA_VERSION,
	isGeneratorRouter,
	validateBackgroundStatProfileRelationships,
	validateCreatureStatProfileRelationships,
	validateGeneratorDefinition,
	validateGeneratorPair,
	validateGeneratorRelationships,
};

const {
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
const {
	isGeneratorRouter,
} = require('./generatorSchema/routerValidation');

module.exports = {
	CREATURE_ROUTER_ID,
	GENERATOR_SCHEMA_VERSION,
	isGeneratorRouter,
	validateCreatureStatProfileRelationships,
	validateGeneratorDefinition,
	validateGeneratorPair,
	validateGeneratorRelationships,
};

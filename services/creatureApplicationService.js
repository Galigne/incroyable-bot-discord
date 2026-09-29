const creatureStore = require('./creatureStore');
const { createEntitySettings } = require('./entitySettings');
const { populateRandomCreature } = require('./randomCreatureGenerator');

async function generateCreature(entityKey, options) {
	return creatureStore.createCreature(
		entityKey,
		createEntitySettings('private'),
		creature => populateRandomCreature(creature, options),
	);
}

module.exports = { generateCreature };

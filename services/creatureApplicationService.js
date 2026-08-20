const creatureStore = require('./creatureStore');
const { populateRandomCreature } = require('./randomCreatureGenerator');

async function generateCreature(entityKey, options) {
	return creatureStore.createCreature(
		entityKey,
		[],
		creature => populateRandomCreature(creature, options),
	);
}

module.exports = { generateCreature };

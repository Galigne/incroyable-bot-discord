const creatureStore = require('./creatureStore');
const { populateRandomCreature } = require('./randomCreatureGenerator');

async function generateCreature(entityKey, creatorId, options) {
	return creatureStore.createCreature(
		entityKey,
		creatorId,
		creature => populateRandomCreature(creature, options),
	);
}

module.exports = { generateCreature };

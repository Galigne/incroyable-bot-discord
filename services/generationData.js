const {
	createGeneratorCatalogCandidate,
	replaceGeneratorCatalog,
} = require('./generatorCatalog');
const {
	createStatProfileCandidate,
	replaceStatProfiles,
} = require('./statProfileCatalog');
const {
	validateBackgroundStatProfileRelationships,
	validateCreatureStatProfileRelationships,
} = require('./generatorSchema');

function reloadGenerationData() {
	const generatorCatalog = createGeneratorCatalogCandidate();
	const statProfiles = createStatProfileCandidate();
	validateBackgroundStatProfileRelationships(generatorCatalog, statProfiles);
	validateCreatureStatProfileRelationships(generatorCatalog, statProfiles);
	replaceGeneratorCatalog(generatorCatalog);
	replaceStatProfiles(statProfiles);
	return { generatorCatalog, statProfiles };
}

module.exports = { reloadGenerationData };

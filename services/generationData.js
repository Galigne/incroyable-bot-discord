const {
	createGeneratorCatalogCandidate,
	replaceGeneratorCatalog,
} = require('./generatorCatalog');
const {
	createStatProfileCandidate,
	replaceStatProfiles,
} = require('./statProfileCatalog');
const {
	validateCreatureStatProfileRelationships,
} = require('./generatorSchema');

function reloadGenerationData() {
	const generatorCatalog = createGeneratorCatalogCandidate();
	const statProfiles = createStatProfileCandidate();
	validateCreatureStatProfileRelationships(generatorCatalog, statProfiles);
	replaceGeneratorCatalog(generatorCatalog);
	replaceStatProfiles(statProfiles);
	return { generatorCatalog, statProfiles };
}

module.exports = { reloadGenerationData };

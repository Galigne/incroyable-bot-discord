const {
	createGeneratorCatalogCandidate,
	replaceGeneratorCatalog,
} = require('./generatorCatalog');
const {
	createStatProfileCandidate,
	replaceStatProfiles,
} = require('./statProfileCatalog');

function reloadGenerationData() {
	const generatorCatalog = createGeneratorCatalogCandidate();
	const statProfiles = createStatProfileCandidate();
	replaceGeneratorCatalog(generatorCatalog);
	replaceStatProfiles(statProfiles);
	return { generatorCatalog, statProfiles };
}

module.exports = { reloadGenerationData };

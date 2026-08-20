const {
	createGeneratorCatalogCandidate,
	replaceGeneratorCatalog,
} = require('./generatorCatalog');
const {
	createStatProfileCandidate,
	replaceStatProfiles,
} = require('./statProfileCatalog');
const {
	validateRoutedArchetypeStatProfileRelationships,
} = require('./generatorSchema');

function reloadGenerationData() {
	const generatorCatalog = createGeneratorCatalogCandidate();
	const statProfiles = createStatProfileCandidate();
	validateRoutedArchetypeStatProfileRelationships(generatorCatalog, statProfiles);
	replaceGeneratorCatalog(generatorCatalog);
	replaceStatProfiles(statProfiles);
	return { generatorCatalog, statProfiles };
}

module.exports = { reloadGenerationData };

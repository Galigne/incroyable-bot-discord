const {
	createGeneratorCatalogCandidate,
} = require('./generatorCatalog');
const {
	createStatProfileCandidate,
} = require('./statProfileCatalog');
const {
	validateGeneratorRelationships,
	validateRoutedArchetypeStatProfileRelationships,
} = require('./generatorSchema');
const {
	clearGenerationData,
	getGenerationData,
	replaceGenerationData: replaceGenerationDataState,
} = require('./generationDataState');

function initializeGenerationData(options = {}) {
	return prepareAndReplaceGenerationData(options);
}

function reloadGenerationData(options = {}) {
	return prepareAndReplaceGenerationData(options);
}

function ensureGenerationData() {
	const activeGenerationData = getGenerationData();
	if (activeGenerationData.generatorCatalog && activeGenerationData.statProfiles) {
		return activeGenerationData;
	}
	return initializeGenerationData();
}

function prepareAndReplaceGenerationData(options = {}) {
	const generatorCatalogCandidateFactory = options.createGeneratorCatalogCandidate
		?? createGeneratorCatalogCandidate;
	const statProfileCandidateFactory = options.createStatProfileCandidate
		?? createStatProfileCandidate;
	const generatorCatalog = generatorCatalogCandidateFactory();
	const statProfiles = statProfileCandidateFactory();
	const candidates = { generatorCatalog, statProfiles };

	return replaceGenerationData(candidates);
}

function replaceGenerationData(candidates) {
	validateGenerationData(candidates);
	replaceGenerationDataState(candidates);
	return candidates;
}

function validateGenerationData({ generatorCatalog, statProfiles } = {}) {
	if (!(generatorCatalog instanceof Map) || !(statProfiles instanceof Map)) {
		throw new TypeError(
			'Generation data validation requires generator and statistical profile maps.',
		);
	}
	for (const locale of ['en', 'fr']) {
		const catalog = generatorCatalog.get(locale);
		if (!(catalog instanceof Map)) {
			throw new TypeError(
				`Generation data is missing the ${locale} generator catalog.`,
			);
		}
		validateGeneratorRelationships(catalog);
	}
	validateRoutedArchetypeStatProfileRelationships(
		generatorCatalog,
		statProfiles,
	);
	return true;
}

module.exports = {
	clearGenerationData,
	ensureGenerationData,
	getGenerationData,
	initializeGenerationData,
	reloadGenerationData,
	replaceGenerationData,
	validateGenerationData,
};

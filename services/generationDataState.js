let activeGenerationData = createEmptyGenerationData();

function getGenerationData() {
	return activeGenerationData;
}

function replaceGenerationData(generationData) {
	if (!generationData || typeof generationData !== 'object') {
		throw new TypeError('Generation data must be an object.');
	}
	if (!(generationData.generatorCatalog instanceof Map)) {
		throw new TypeError('Generation data requires a generator catalog map.');
	}
	if (!(generationData.statProfiles instanceof Map)) {
		throw new TypeError('Generation data requires a statistical profile map.');
	}
	activeGenerationData = Object.freeze({
		generatorCatalog: generationData.generatorCatalog,
		statProfiles: generationData.statProfiles,
	});
	return activeGenerationData;
}

function clearGenerationData() {
	activeGenerationData = createEmptyGenerationData();
}

function createEmptyGenerationData() {
	return Object.freeze({
		generatorCatalog: null,
		statProfiles: null,
	});
}

module.exports = {
	clearGenerationData,
	getGenerationData,
	replaceGenerationData,
};

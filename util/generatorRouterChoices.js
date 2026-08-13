const generatorCatalog = require('../services/generatorCatalog');

function getLocalizedRouterChoices(routerId, locale = 'en') {
	const englishEntries = generatorCatalog.getGenerator(routerId, 'en')?.entries ?? [];
	const localizedEntries = generatorCatalog.getGenerator(routerId, locale)?.entries ?? [];
	const englishById = new Map(englishEntries.map(entry => [entry.id, entry]));
	return localizedEntries.map(entry => ({
		name: `${entry.fields.name} \u2014 ${entry.fields.description}`.slice(0, 100),
		value: englishById.get(entry.id)?.id ?? entry.id,
	}));
}

module.exports = {
	getLocalizedRouterChoices,
};

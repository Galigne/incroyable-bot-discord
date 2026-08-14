const generatorCatalog = require('../services/generatorCatalog');

function getLocalizedRouterChoices(routerId, locale = 'en') {
	const localizedEntries = generatorCatalog.getGenerator(routerId, locale)?.entries ?? [];
	return localizedEntries.map(entry => ({
		name: `${entry.name} \u2014 ${entry.fields.description}`.slice(0, 100),
		value: entry.id,
	}));
}

module.exports = {
	getLocalizedRouterChoices,
};

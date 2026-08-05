const generatorCatalog = require('../services/generatorCatalog');
const {
	getCharacterSections,
} = require('../services/characterFieldCatalog');
const { getCharacterFieldLabel } = require('./characterDisplay');

const OPTION_VALUE_PROVIDERS = Object.freeze({
	'character-sections': getCharacterSectionValues,
	'generator-categories': getGeneratorCategoryValues,
});

function getCommandOptionValues(providerName, locale = 'en') {
	const provider = OPTION_VALUE_PROVIDERS[providerName];
	return provider ? provider(locale) : null;
}

function getCharacterSectionValues(locale) {
	return getCharacterSections().map(field => {
		const label = getCharacterFieldLabel(locale, field.id);
		return {
			label,
			name: `${label} (${field.sectionId})`,
			value: field.sectionId,
		};
	});
}

function getGeneratorCategoryValues(locale) {
	return generatorCatalog.listGenerators(locale).map(category => ({
		description: category.description,
		label: category.name,
		name: `${category.name} — ${category.description}`,
		value: category.id,
	}));
}

module.exports = {
	OPTION_VALUE_PROVIDERS,
	getCommandOptionValues,
};

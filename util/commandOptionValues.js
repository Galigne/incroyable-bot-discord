const generatorCatalog = require('../services/generatorCatalog');
const {
	getCharacterSections,
} = require('../services/characterFieldCatalog');
const { getAllEntitySections } = require('../services/entityFieldCatalog');
const { getCharacterFieldLabel } = require('./characterDisplay');
const { getEntityFieldLabel } = require('./entityDisplay');
const { t } = require('./i18n');

const OPTION_VALUE_PROVIDERS = Object.freeze({
	'character-sections': getCharacterSectionValues,
	'entity-sections': getEntitySectionValues,
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

function getEntitySectionValues(locale) {
	const catalogs = getAllEntitySections();
	const choices = [
		...createEntitySectionValues('character', catalogs.character, locale),
		...createEntitySectionValues('creature', catalogs.creature, locale),
	];
	return choices.filter((choice, index) => (
		choices.findIndex(candidate => candidate.value === choice.value) === index
	));
}

function createEntitySectionValues(type, sections, locale) {
	return sections.map(field => {
		const label = getEntityFieldLabel(locale, type, field.id);
		return {
			label,
			name: `${label} (${field.sectionId}) - ${t(
				locale,
				`entity.types.${type}`,
			)}`,
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

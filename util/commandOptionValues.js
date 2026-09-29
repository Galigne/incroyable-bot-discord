const generatorCatalog = require('../services/generatorCatalog');
const {
	createGeneratorTraversalAlias,
} = require('../services/generatorTraversal');
const {
	getCharacterSections,
} = require('../services/characterFieldCatalog');
const {
	getAllEditableEntityFields,
	getViewableEntityFields,
} = require('../services/entityFieldCatalog');
const { getCharacterFieldLabel } = require('./characterDisplay');
const { getEntityFieldLabel } = require('./entityDisplay');
const { t } = require('./i18n');

const OPTION_VALUE_PROVIDERS = Object.freeze({
	'character-sections': getCharacterSectionValues,
	'entity-sections': getEntitySectionValues,
	'get-entity-sections': getGetEntitySectionValues,
	'generator-paths': getGeneratorRootValues,
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
	const catalogs = getAllEditableEntityFields();
	const choices = [
		...createEntitySectionValues(
			'character',
			catalogs.character,
			'editId',
			locale,
		),
		...createEntitySectionValues(
			'creature',
			catalogs.creature,
			'editId',
			locale,
		),
	];
	return choices.filter((choice, index) => (
		choices.findIndex(candidate => candidate.value === choice.value) === index
	));
}

function getGetEntitySectionValues(locale) {
	const choices = [
		...createEntitySectionValues(
			'character',
			getViewableEntityFields('character'),
			'viewId',
			locale,
		),
		...createEntitySectionValues(
			'creature',
			getViewableEntityFields('creature'),
			'viewId',
			locale,
		),
	];
	return [
		{
			label: t(locale, 'rpg.get.allField'),
			name: `${t(locale, 'rpg.get.allField')} (all)`,
			value: 'all',
		},
		...choices.filter((choice, index) => (
			choices.findIndex(candidate => candidate.value === choice.value) === index
		)),
	];
}

function createEntitySectionValues(type, sections, valueProperty, locale) {
	return sections.map(field => {
		const label = getEntityFieldLabel(locale, type, field.id);
		const value = field[valueProperty];
		return {
			label,
			name: `${label} (${value}) - ${t(
				locale,
				`entity.types.${type}`,
			)}`,
			value,
		};
	});
}

function getGeneratorRootValues(locale) {
	return generatorCatalog.listGenerators(locale).map(category => ({
		description: category.description,
		label: category.name,
		name: createGeneratorTraversalAlias(category.name),
		value: createGeneratorTraversalAlias(category.name),
	}));
}

module.exports = {
	OPTION_VALUE_PROVIDERS,
	getCommandOptionValues,
};

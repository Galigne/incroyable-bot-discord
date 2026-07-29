const generatorCatalog = require('../services/generatorCatalog');
const {
	getCharacterFieldDefinition,
	getEditableFields,
} = require('../services/characterFieldCatalog');
const { getCharacterFieldLabel } = require('./characterDisplay');
const { t } = require('./i18n');

const OPTION_VALUE_PROVIDERS = Object.freeze({
	'editable-fields': getEditableFieldValues,
	'generator-categories': getGeneratorCategoryValues,
});

function getCommandOptionValues(providerName, locale = 'en') {
	const provider = OPTION_VALUE_PROVIDERS[providerName];
	return provider ? provider(locale) : null;
}

function getEditableFieldValues(locale) {
	return getEditableFields().map(field => {
		const label = getCharacterFieldLabel(locale, field.id);
		return {
			group: getEditableFieldGroup(field, locale),
			label,
			name: `${label} (${field.editId})`,
			value: field.editId,
		};
	});
}

function getEditableFieldGroup(field, locale) {
	if (field.id === 'statistics') {
		return {
			key: 'statistics',
			label: getCharacterFieldLabel(locale, 'statistics'),
		};
	}
	if (!field.id.includes('.')) {
		return {
			key: 'general',
			label: t(locale, 'commands.help.valueGroups.general'),
		};
	}
	const rootId = field.id.split('.')[0];
	if (rootId === 'resources') {
		return {
			key: 'resources',
			label: t(locale, 'commands.help.valueGroups.resources'),
		};
	}
	const definition = getCharacterFieldDefinition(rootId);
	return {
		key: definition?.id ?? rootId,
		label: getCharacterFieldLabel(locale, definition?.id ?? rootId) ?? rootId,
	};
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

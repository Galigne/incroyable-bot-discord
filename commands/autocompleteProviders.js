const generatorCatalog = require('../services/generatorCatalog');
const {
	getEditableFields,
	getViewableFields,
} = require('../services/characterFieldCatalog');
const { filterAutocompleteChoices } = require('../util/autocomplete');
const { hasDmPermission } = require('../util/authorization');
const {
	getCharacterFieldLabel,
} = require('../util/characterDisplay');
const { t } = require('../util/i18n');
const { getCharacterChoices } = require('./rpg/autocomplete');

async function getAutocompleteChoices(metadata, option, context) {
	const provider = AUTOCOMPLETE_PROVIDERS[option.autocomplete.provider];
	if (!provider) {
		throw new Error(
			`Unknown autocomplete provider "${option.autocomplete.provider}" `
			+ `for ${metadata.id}.${option.name}.`,
		);
	}
	const focused = context.interaction.options.getFocused(true);
	return provider(option, context, focused);
}

const AUTOCOMPLETE_PROVIDERS = {
	static: getStaticChoices,
	backgrounds: getBackgroundChoices,
	characters: (option, context, focused) => getCharacterChoices(focused.value),
	'editable-fields': getEditableFieldChoices,
	'generator-categories': getGeneratorCategoryChoices,
	'manageable-characters': getManageableCharacterChoices,
	'viewable-fields': getViewableFieldChoices,
};

function getStaticChoices(option, context, focused) {
	const locale = context.locale;
	return filterAutocompleteChoices(
		option.autocomplete.values.map(value => normalizeStaticChoice(value, locale)),
		focused.value,
	);
}

function normalizeStaticChoice(choice, locale) {
	if (typeof choice !== 'object') {
		return { name: String(choice), value: choice };
	}
	return {
		name: choice.nameKey
			? t(locale, choice.nameKey, choice.nameVariables)
			: choice.name ?? String(choice.value),
		value: choice.value,
	};
}

function getBackgroundChoices(option, context, focused) {
	const english = generatorCatalog.getGenerator('background', 'en')?.entries ?? [];
	const localized = generatorCatalog.getGenerator(
		'background',
		context.locale,
	)?.entries ?? [];
	return filterAutocompleteChoices(
		localized.map((entry, index) => ({
			name: `${entry.fields.Name} — ${entry.fields.Description}`.slice(0, 100),
			value: english[index].fields.Name,
		})),
		focused.value,
	);
}

function getEditableFieldChoices(option, context, focused) {
	return filterAutocompleteChoices(
		getEditableFields().map(field => ({
			name: (
				`${getCharacterFieldLabel(context.locale, field.id)} (${field.editId})`
			).slice(0, 100),
			value: field.editId,
		})),
		focused.value,
	);
}

function getGeneratorCategoryChoices(option, context, focused) {
	return filterAutocompleteChoices(
		generatorCatalog.listGenerators(context.locale).map(category => ({
			name: `${category.name} — ${category.description}`.slice(0, 100),
			value: category.id,
		})),
		focused.value,
	);
}

function getManageableCharacterChoices(option, context, focused) {
	return getCharacterChoices(
		focused.value,
		hasDmPermission(context.interaction, context.config)
			? {}
			: { creatorId: context.interaction.user.id },
	);
}

function getViewableFieldChoices(option, context, focused) {
	return filterAutocompleteChoices(
		getViewableFields().map(field => {
			const label = getCharacterFieldLabel(context.locale, field.id, {
				abbreviated: Boolean(field.abbreviationKey),
			});
			return {
				name: (label === field.viewId
					? label
					: `${label} (${field.viewId})`).slice(0, 100),
				value: field.viewId,
			};
		}),
		focused.value,
	);
}

module.exports = {
	AUTOCOMPLETE_PROVIDERS,
	getAutocompleteChoices,
};

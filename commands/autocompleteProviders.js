const generatorCatalog = require('../services/generatorCatalog');
const {
	getViewableFields,
} = require('../services/characterFieldCatalog');
const { filterAutocompleteChoices } = require('../util/autocomplete');
const { hasDmPermission } = require('../util/authorization');
const {
	OPTION_VALUE_PROVIDERS,
	getCommandOptionValues,
} = require('../util/commandOptionValues');
const {
	getCharacterFieldLabel,
} = require('../util/characterDisplay');
const {
	getCommandInvocation,
	getCommandLookupValue,
} = require('../util/helpResponses');
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
	...Object.fromEntries(
		Object.keys(OPTION_VALUE_PROVIDERS).map(providerName => [
			providerName,
			getCanonicalValueChoices,
		]),
	),
	static: getStaticChoices,
	backgrounds: getBackgroundChoices,
	characters: (option, context, focused) => getCharacterChoices(focused.value),
	'help-commands': getHelpCommandChoices,
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

function getCanonicalValueChoices(option, context, focused) {
	return filterAutocompleteChoices(
		getCommandOptionValues(option.autocomplete.provider, context.locale),
		focused.value,
	);
}

function getHelpCommandChoices(option, context, focused) {
	const allCommands = context.registry.getHelpMetadata();
	const commands = canFilterHelpCommands(context.interaction)
		? context.registry.getVisibleHelpMetadata(
			context.interaction,
			context.config,
		)
		: allCommands;
	return filterAutocompleteChoices(
		commands.map(metadata => ({
			name: (
				`${getCommandInvocation(metadata)} — ${t(
					context.locale,
					metadata.help.summaryKey ?? metadata.descriptionKey,
				)}`
			).slice(0, 100),
			value: getCommandLookupValue(metadata),
		})),
		focused.value,
	);
}

function canFilterHelpCommands(interaction) {
	return Boolean(
		interaction?.guild
		&& interaction.user?.id
		&& (
			interaction.guild.ownerId === interaction.user.id
			|| interaction.member?.roles
		),
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

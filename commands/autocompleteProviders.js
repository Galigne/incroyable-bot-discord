const {
	getGeneratorTraversalSuggestions,
	getScopedGeneratorTraversalSuggestions,
} = require('../services/generatorTraversal');
const generatorCatalog = require('../services/generatorCatalog');
const {
	filterAutocompleteChoices,
	MAX_AUTOCOMPLETE_CHOICES,
} = require('../util/autocomplete');
const {
	canManageEntity,
	hasFullEntityAuthority,
} = require('../util/authorization');
const {
	OPTION_VALUE_PROVIDERS,
	getCommandOptionValues,
} = require('../util/commandOptionValues');
const {
	getCommandInvocation,
	getCommandLookupValue,
} = require('../util/helpResponses');
const { t } = require('../util/i18n');
const {
	getEntityChoices,
	getEntitySectionChoices,
	getUndoableEntityChoices,
} = require('./entity/autocomplete');

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
	'generator-paths': getGeneratorPathChoices,
	static: getStaticChoices,
	backgrounds: getBackgroundChoices,
	'creature-types': getCreatureTypeChoices,
	entities: (option, context, focused) => getEntityChoices(
		focused.value,
		context.locale,
	),
	'entity-sections': getEntitySections,
	'help-commands': getHelpCommandChoices,
	'full-authority-entities': getFullAuthorityEntityChoices,
	'manageable-entities': getManageableEntityChoices,
	'undoable-entities': getUndoableEntities,
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
	return getRoutedArchetypePathChoices(
		'background',
		context.locale,
		focused.value,
	);
}

function getCanonicalValueChoices(option, context, focused) {
	return filterAutocompleteChoices(
		getCommandOptionValues(option.autocomplete.provider, context.locale),
		focused.value,
	);
}

function getGeneratorPathChoices(option, context, focused) {
	return getGeneratorTraversalSuggestions(
		focused.value,
		context.locale,
	)
		.filter(choice => choice.value.length <= 100)
		.slice(0, MAX_AUTOCOMPLETE_CHOICES)
		.map(choice => ({
			name: choice.value,
			value: choice.value,
		}));
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

function getManageableEntityChoices(option, context, focused) {
	return getEntityChoices(
		focused.value,
		context.locale,
		{
			filterEntity: entity => canManageEntity(
				context.interaction,
				entity,
				context.config,
			),
		},
	);
}

function getFullAuthorityEntityChoices(option, context, focused) {
	return getEntityChoices(
		focused.value,
		context.locale,
		{
			filterEntity: entity => hasFullEntityAuthority(
				context.interaction,
				entity,
				context.config,
			),
		},
	);
}

function getCreatureTypeChoices(option, context, focused) {
	return getRoutedArchetypePathChoices(
		'creature',
		context.locale,
		focused.value,
	);
}

function getRoutedArchetypePathChoices(rootId, locale, focusedValue) {
	const terminalGeneratorIds = new Set(
		(generatorCatalog.getGenerator(rootId, locale)?.entries ?? [])
			.map(entry => entry.generator)
			.filter(Boolean),
	);
	return getScopedGeneratorTraversalSuggestions(
		focusedValue,
		rootId,
		locale,
		{ terminalGeneratorIds },
	)
		.filter(choice => choice.value.length <= 100)
		.slice(0, MAX_AUTOCOMPLETE_CHOICES)
		.map(choice => ({
			name: choice.value,
			value: choice.value,
		}));
}

function getUndoableEntities(option, context, focused) {
	return getUndoableEntityChoices(
		focused.value,
		context.locale,
		entity => canManageEntity(context.interaction, entity, context.config),
	);
}

function getEntitySections(option, context, focused) {
	return getEntitySectionChoices(
		focused.value,
		context.locale,
		context.interaction.options.getString?.('entity-key') ?? '',
	);
}

module.exports = {
	AUTOCOMPLETE_PROVIDERS,
	getAutocompleteChoices,
};

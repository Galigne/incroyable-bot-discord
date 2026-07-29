const {
	InteractionContextType,
	SlashCommandBuilder,
} = require('discord.js');
const { hasTranslationKey, t, translations } = require('./i18n');

const VALID_COMMAND_CATEGORIES = Object.freeze([
	'general',
	'moderation',
	'rpg',
]);
const VALID_PERMISSION_LEVELS = Object.freeze([
	'everyone',
	'dm',
	'moderator',
	'owner',
]);
const VALID_OPTION_TYPES = Object.freeze([
	'boolean',
	'integer',
	'number',
	'string',
]);

function validateCommandMetadata(metadataList) {
	const errors = [];
	const ids = new Set();
	const scopedNames = new Set();
	const groups = new Set(metadataList
		.filter(metadata => metadata.group)
		.map(metadata => metadata.name));

	for (const metadata of metadataList) {
		const label = metadata.id ?? metadata.name ?? '<unknown>';
		if (!metadata.id || ids.has(metadata.id)) {
			errors.push(`${label}: command IDs must be present and unique.`);
		}
		ids.add(metadata.id);

		const scope = metadata.parent ?? 'top-level';
		const scopedName = `${scope}:${metadata.name}`;
		if (!metadata.name || scopedNames.has(scopedName)) {
			errors.push(`${label}: command names must be unique within their parent.`);
		}
		scopedNames.add(scopedName);

		if (!VALID_COMMAND_CATEGORIES.includes(metadata.category)) {
			errors.push(`${label}: invalid category "${metadata.category}".`);
		}
		if (!VALID_PERMISSION_LEVELS.includes(metadata.permission)) {
			errors.push(`${label}: invalid permission "${metadata.permission}".`);
		}
		if (typeof metadata.guildOnly !== 'boolean') {
			errors.push(`${label}: guildOnly must be a boolean.`);
		}
		if (!Array.isArray(metadata.examples) || metadata.examples.length === 0) {
			errors.push(`${label}: at least one usage example is required.`);
		}
		if (!Number.isFinite(metadata.help?.order)) {
			errors.push(`${label}: help.order must be numeric.`);
		}
		if (metadata.parent && !groups.has(metadata.parent)) {
			errors.push(`${label}: parent group "${metadata.parent}" does not exist.`);
		}
		if (!Number.isFinite(metadata.registrationOrder)) {
			errors.push(`${label}: registrationOrder must be numeric.`);
		}
		if (metadata.group && metadata.parent) {
			errors.push(`${label}: a command group cannot have a parent.`);
		}
		if (!metadata.group && typeof metadata.handler !== 'string') {
			errors.push(`${label}: a handler path is required.`);
		}

		validateTranslationKey(metadata.descriptionKey, `${label}.descriptionKey`, errors);
		for (const keyName of ['summaryKey', 'detailsKey']) {
			if (metadata.help?.[keyName]) {
				validateTranslationKey(
					metadata.help[keyName],
					`${label}.help.${keyName}`,
					errors,
				);
			}
		}
		validateOptions(metadata.options, label, errors);
	}
	return errors;
}

function assertValidCommandMetadata(metadataList) {
	const errors = validateCommandMetadata(metadataList);
	if (errors.length > 0) {
		throw new Error(`Invalid command metadata:\n${errors.join('\n')}`);
	}
}

function validateOptions(options, commandLabel, errors) {
	if (!Array.isArray(options)) {
		errors.push(`${commandLabel}: options must be an array.`);
		return;
	}
	const names = new Set();
	for (const option of options) {
		const label = `${commandLabel}.${option.name ?? '<unknown>'}`;
		if (!option.name || names.has(option.name)) {
			errors.push(`${label}: option names must be present and unique.`);
		}
		names.add(option.name);
		if (!VALID_OPTION_TYPES.includes(option.type)) {
			errors.push(`${label}: invalid option type "${option.type}".`);
		}
		validateTranslationKey(option.descriptionKey, `${label}.descriptionKey`, errors);
		if (option.choices && option.autocomplete) {
			errors.push(`${label}: choices and autocomplete cannot both be configured.`);
		}
		for (const choice of option.choices ?? []) {
			if (choice.nameKey) {
				validateTranslationKey(choice.nameKey, `${label}.choice.nameKey`, errors);
			}
			else if (typeof choice.name !== 'string') {
				errors.push(`${label}: every choice needs a name or nameKey.`);
			}
			if (!Object.hasOwn(choice, 'value')) {
				errors.push(`${label}: every choice needs a value.`);
			}
		}
		if (option.autocomplete && typeof option.autocomplete.provider !== 'string') {
			errors.push(`${label}: autocomplete.provider is required.`);
		}
		for (const suggestion of option.autocomplete?.values ?? []) {
			if (suggestion?.nameKey) {
				validateTranslationKey(
					suggestion.nameKey,
					`${label}.autocomplete.nameKey`,
					errors,
				);
			}
		}
	}
}

function validateTranslationKey(key, label, errors) {
	for (const locale of Object.keys(translations)) {
		if (!hasTranslationKey(locale, key)) {
			errors.push(`${label}: missing "${key}" for locale "${locale}".`);
		}
	}
}

function createDiscordCommandData(metadata, subcommands = []) {
	const builder = configureDescription(
		new SlashCommandBuilder().setName(metadata.name),
		metadata.descriptionKey,
	);
	if (metadata.guildOnly) {
		builder.setContexts(InteractionContextType.Guild);
	}
	if (metadata.group) {
		for (const subcommand of subcommands) {
			builder.addSubcommand(option => configureCommandOptions(
				configureDescription(option.setName(subcommand.name), subcommand.descriptionKey),
				subcommand.options,
			));
		}
		return builder;
	}
	return configureCommandOptions(builder, metadata.options);
}

function configureCommandOptions(builder, options) {
	for (const option of options) {
		const method = {
			boolean: 'addBooleanOption',
			integer: 'addIntegerOption',
			number: 'addNumberOption',
			string: 'addStringOption',
		}[option.type];
		builder[method](optionBuilder => configureOption(optionBuilder, option));
	}
	return builder;
}

function configureOption(builder, option) {
	configureDescription(builder.setName(option.name), option.descriptionKey);
	if (option.required) {
		builder.setRequired(true);
	}
	if (option.autocomplete) {
		builder.setAutocomplete(true);
	}
	if (option.choices) {
		builder.addChoices(...option.choices.map(createLocalizedChoice));
	}
	for (const [property, method] of [
		['minLength', 'setMinLength'],
		['maxLength', 'setMaxLength'],
		['minValue', 'setMinValue'],
		['maxValue', 'setMaxValue'],
	]) {
		if (option[property] !== undefined) {
			builder[method](option[property]);
		}
	}
	return builder;
}

function configureDescription(builder, descriptionKey) {
	return builder
		.setDescription(t('en', descriptionKey))
		.setDescriptionLocalizations({ fr: t('fr', descriptionKey) });
}

function createLocalizedChoice(choice) {
	if (!choice.nameKey) {
		return { name: choice.name, value: choice.value };
	}
	return {
		name: t('en', choice.nameKey, choice.nameVariables),
		name_localizations: {
			fr: t('fr', choice.nameKey, choice.nameVariables),
		},
		value: choice.value,
	};
}

module.exports = {
	VALID_COMMAND_CATEGORIES,
	VALID_OPTION_TYPES,
	VALID_PERMISSION_LEVELS,
	assertValidCommandMetadata,
	createDiscordCommandData,
	createLocalizedChoice,
	validateCommandMetadata,
};

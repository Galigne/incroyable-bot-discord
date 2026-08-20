const { EmbedBuilder, MessageFlags } = require('discord.js');
const { VALID_COMMAND_CATEGORIES } = require('./commandMetadata');
const { getCommandOptionValues } = require('./commandOptionValues');
const { t } = require('./i18n');

const EMBED_FIELD_LIMIT = 1_024;
const SAFE_FIELD_LIMIT = 1_000;

function createHelpResponse({
	avatarUrl,
	commandName,
	config,
	interaction,
	locale = 'en',
	registry,
}) {
	if (!commandName) {
		return createCommandListResponse(
			registry.getVisibleHelpMetadata(interaction, config),
			avatarUrl,
			locale,
		);
	}
	const metadata = registry.getVisibleHelpCommand(
		commandName,
		interaction,
		config,
	);
	if (!metadata) {
		return {
			content: t(locale, 'commands.help.unknownCommand', {
				command: commandName,
			}),
			flags: MessageFlags.Ephemeral,
		};
	}
	return createCommandDetailResponse(metadata, avatarUrl, locale);
}

function createCommandListResponse(commands, avatarUrl, locale = 'en') {
	const embed = new EmbedBuilder()
		.setTitle(t(locale, 'commands.help.title'))
		.setDescription(t(locale, 'commands.help.available'))
		.setColor('#FFD700')
		.setThumbnail(avatarUrl);
	for (const category of VALID_COMMAND_CATEGORIES) {
		const categoryCommands = commands
			.filter(metadata => metadata.category === category)
			.sort((left, right) => left.help.order - right.help.order);
		if (categoryCommands.length === 0) {
			continue;
		}
		const lines = categoryCommands.map(metadata => (
			`**${getCommandInvocation(metadata)}** — ${getCommandSummary(metadata, locale)}`
		));
		addChunkedFields(
			embed,
			t(locale, `commands.help.categories.${category}`),
			lines.join('\n'),
			locale,
		);
	}
	return { embeds: [embed] };
}

function createCommandDetailResponse(metadata, avatarUrl, locale = 'en') {
	const invocation = getCommandInvocation(metadata);
	const embed = new EmbedBuilder()
		.setTitle(t(locale, 'commands.help.detailTitle', { command: invocation }))
		.setDescription(getCommandSummary(metadata, locale))
		.setColor('#FFD700')
		.setThumbnail(avatarUrl)
		.addFields({
			name: t(locale, 'commands.help.permissionTitle'),
			value: t(locale, `commands.help.permissions.${metadata.permission}`),
		});
	const parameters = metadata.options.length === 0
		? t(locale, 'commands.help.noParameters')
		: metadata.options.map(option => formatParameter(option, locale)).join('\n\n');
	addChunkedFields(
		embed,
		t(locale, 'commands.help.parametersTitle'),
		parameters,
		locale,
	);
	addChunkedFields(
		embed,
		t(locale, 'commands.help.examplesTitle'),
		metadata.examples.map(example => `\`${example}\``).join('\n'),
		locale,
	);
	addChunkedFields(
		embed,
		t(locale, 'commands.help.behaviorTitle'),
		t(locale, metadata.help.detailsKey),
		locale,
	);
	return { embeds: [embed] };
}

function formatParameter(option, locale) {
	const requirement = option.required
		? t(locale, 'commands.help.required')
		: t(locale, 'commands.help.optional');
	return [
		`**${option.name}** — ${t(locale, `commands.help.types.${option.type}`)} · ${requirement}`,
		t(locale, option.descriptionKey),
		`${t(locale, 'commands.help.acceptedTitle')}: ${formatAcceptedValues(option, locale)}`,
	].join('\n');
}

function formatAcceptedValues(option, locale) {
	if (option.acceptedValuesKey) {
		return t(locale, option.acceptedValuesKey);
	}
	if (option.autocomplete?.showAllInHelp) {
		const values = getCommandOptionValues(option.autocomplete.provider, locale);
		if (values) {
			return [
				t(locale, 'commands.help.accepted.autocompleteComplete', {
					count: values.length,
				}),
				formatDocumentedValues(values),
			].join('\n');
		}
	}
	if (option.choices) {
		return option.choices.map(choice => {
			const label = choice.nameKey
				? t(locale, choice.nameKey, choice.nameVariables)
				: choice.name;
			return `\`${choice.value}\` (${label})`;
		}).join(', ');
	}
	if (option.type === 'boolean') {
		return '`true`, `false`';
	}
	if (option.type === 'user') {
		return t(locale, 'commands.help.accepted.user');
	}
	if (option.minValue !== undefined && option.maxValue !== undefined) {
		return t(locale, 'commands.help.accepted.numberRange', {
			max: option.maxValue,
			min: option.minValue,
		});
	}
	if (option.minValue !== undefined) {
		return t(locale, 'commands.help.accepted.numberMinimum', {
			min: option.minValue,
		});
	}
	if (option.maxValue !== undefined) {
		return t(locale, 'commands.help.accepted.numberMaximum', {
			max: option.maxValue,
		});
	}
	if (option.minLength !== undefined && option.maxLength !== undefined) {
		return t(locale, 'commands.help.accepted.lengthRange', {
			max: option.maxLength,
			min: option.minLength,
		});
	}
	if (option.maxLength !== undefined) {
		return t(locale, 'commands.help.accepted.lengthMaximum', {
			max: option.maxLength,
		});
	}
	if (option.autocomplete) {
		return t(locale, 'commands.help.accepted.autocomplete');
	}
	return option.type === 'string'
		? t(locale, 'commands.help.accepted.freeText')
		: t(locale, 'commands.help.accepted.number');
}

function formatDocumentedValues(values) {
	if (!values.some(value => value.group)) {
		return values.map(value => (
			`\`${value.value}\` — ${value.description ?? value.label}`
		)).join('\n');
	}
	const groups = new Map();
	for (const value of values) {
		const group = value.group ?? { key: 'other', label: 'Other' };
		const entries = groups.get(group.key) ?? {
			label: group.label,
			values: [],
		};
		entries.values.push(value);
		groups.set(group.key, entries);
	}
	return [...groups.values()].map(group => [
		`**${group.label}**`,
		...group.values.map(value => `\`${value.value}\` — ${value.label}`),
	].join('\n')).join('\n\n');
}

function addChunkedFields(embed, label, value, locale) {
	for (const [index, chunk] of chunkText(value).entries()) {
		embed.addFields({
			name: index === 0
				? label
				: t(locale, 'common.continued', { label }),
			value: chunk,
		});
	}
}

function chunkText(value, maxLength = SAFE_FIELD_LIMIT) {
	const text = String(value);
	const chunks = [];
	let remaining = text;
	while (remaining.length > maxLength) {
		let splitAt = remaining.lastIndexOf('\n', maxLength);
		if (splitAt <= 0) {
			splitAt = maxLength;
		}
		chunks.push(remaining.slice(0, splitAt));
		remaining = remaining.slice(splitAt).replace(/^\n/, '');
	}
	if (remaining) {
		chunks.push(remaining);
	}
	if (chunks.some(chunk => chunk.length > EMBED_FIELD_LIMIT)) {
		throw new Error('Help field exceeds Discord embed limits.');
	}
	return chunks;
}

function getCommandSummary(metadata, locale) {
	return t(
		locale,
		metadata.help.summaryKey ?? metadata.descriptionKey,
	);
}

function getCommandInvocation(metadata) {
	return metadata.parent
		? `/${metadata.parent} ${metadata.name}`
		: `/${metadata.name}`;
}

function getCommandLookupValue(metadata) {
	return metadata.parent
		? `${metadata.parent} ${metadata.name}`
		: metadata.name;
}

module.exports = {
	chunkText,
	createCommandDetailResponse,
	createCommandListResponse,
	createHelpResponse,
	getCommandInvocation,
	getCommandLookupValue,
};

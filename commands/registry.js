const path = require('node:path');
const { Collection, MessageFlags } = require('discord.js');
const { authorizeCommand } = require('../util/authorization');
const {
	assertValidCommandMetadata,
	createDiscordCommandData,
} = require('../util/commandMetadata');
const { getLocale, t } = require('../util/i18n');
const {
	AUTOCOMPLETE_PROVIDERS,
	getAutocompleteChoices,
} = require('./autocompleteProviders');
const { OPTION_VALUE_PROVIDERS } = require('../util/commandOptionValues');
const { COMMAND_METADATA } = require('./metadata');

class CommandRegistry {
	constructor(metadataList, options = {}) {
		assertValidCommandMetadata(metadataList);
		assertKnownAutocompleteProviders(metadataList);
		this.metadata = Object.freeze(metadataList.map(deepFreeze));
		this.authorization = options.authorization ?? authorizeCommand;
		this.handlerLoader = options.handlerLoader ?? loadHandler;
		this.byId = new Map(this.metadata.map(metadata => [metadata.id, metadata]));
		this.runtimeCommands = this.createRuntimeCommands();
	}

	getAllCommands() {
		return [...this.metadata];
	}

	getCommand(name, category) {
		if (category) {
			return this.metadata.find(metadata => (
				metadata.name === name
				&& metadata.category === category
			)) ?? null;
		}
		if (this.byId.has(name)) {
			return this.byId.get(name);
		}
		const normalizedName = name.includes(' ')
			? name.replace(' ', ':')
			: null;
		if (normalizedName && this.byId.has(normalizedName)) {
			return this.byId.get(normalizedName);
		}
		const matches = this.metadata.filter(metadata => (
			metadata.name === name
		));
		return matches.find(metadata => !metadata.parent) ?? matches[0] ?? null;
	}

	groupByCategory() {
		const groups = new Map();
		for (const metadata of this.metadata) {
			const commands = groups.get(metadata.category) ?? [];
			commands.push(metadata);
			groups.set(metadata.category, commands);
		}
		return groups;
	}

	filterByUserPermissions(interaction, config, commands = this.metadata) {
		return commands.filter(metadata => (
			this.authorization(metadata, interaction, config).allowed
		));
	}

	getDiscordCommandData() {
		return [...this.runtimeCommands.values()].map(command => command.data);
	}

	getRuntimeCommands() {
		return this.runtimeCommands;
	}

	getHelpMetadata(category) {
		return this.metadata
			.filter(metadata => (
				!metadata.group
				&& (!category || metadata.category === category)
			))
			.sort((left, right) => left.help.order - right.help.order);
	}

	getVisibleHelpMetadata(interaction, config, category) {
		return this.filterByUserPermissions(
			interaction,
			config,
			this.getHelpMetadata(category),
		);
	}

	getVisibleHelpCommand(name, interaction, config) {
		const metadata = this.getCommand(name);
		if (
			!metadata
			|| metadata.group
			|| !this.authorization(metadata, interaction, config).allowed
		) {
			return null;
		}
		return metadata;
	}

	getAutocompleteMetadata(commandName, optionName, category) {
		const metadata = this.getCommand(commandName, category);
		return metadata?.options.find(option => option.name === optionName) ?? null;
	}

	createRuntimeCommands() {
		const commands = new Collection();
		const topLevel = this.metadata
			.filter(entry => !entry.parent)
			.sort((left, right) => left.registrationOrder - right.registrationOrder);
		for (const metadata of topLevel) {
			const children = this.metadata
				.filter(entry => entry.parent === metadata.name)
				.sort((left, right) => left.registrationOrder - right.registrationOrder);
			const runtime = metadata.group
				? this.createGroupRuntime(metadata, children)
				: this.createCommandRuntime(metadata);
			commands.set(metadata.name, runtime);
		}
		return commands;
	}

	createCommandRuntime(metadata) {
		const handler = this.handlerLoader(metadata);
		if (typeof handler.execute !== 'function') {
			throw new Error(`${metadata.handler} must export an execute function.`);
		}
		const runtime = createRuntimeMetadata(metadata);
		runtime.data = createDiscordCommandData(metadata);
		runtime.execute = context => handler.execute(this.createContext(metadata, context));
		if (metadata.options.some(option => option.autocomplete)) {
			runtime.autocomplete = context => this.respondToAutocomplete(metadata, context);
		}
		return runtime;
	}

	createGroupRuntime(metadata, children) {
		const runtime = createRuntimeMetadata(metadata);
		runtime.data = createDiscordCommandData(metadata, children);
		runtime.subcommands = new Map(children.map(child => [
			child.name,
			this.createSubcommandRuntime(child),
		]));
		runtime.execute = context => this.executeSubcommand(runtime, context);
		if (children.some(child => child.options.some(option => option.autocomplete))) {
			runtime.autocomplete = context => this.autocompleteSubcommand(runtime, context);
		}
		return runtime;
	}

	createSubcommandRuntime(metadata) {
		const handler = this.handlerLoader(metadata);
		if (typeof handler.execute !== 'function') {
			throw new Error(`${metadata.handler} must export an execute function.`);
		}
		return {
			...createRuntimeMetadata(metadata),
			execute: context => handler.execute(this.createContext(metadata, context)),
			...(metadata.options.some(option => option.autocomplete)
				? {
					autocomplete: context => this.respondToAutocomplete(metadata, context),
				}
				: {}),
		};
	}

	async executeSubcommand(group, context) {
		const subcommand = group.subcommands.get(
			context.interaction.options.getSubcommand(),
		);
		if (!subcommand) {
			throw new Error(`Unknown subcommand for /${group.name}.`);
		}
		const authorization = this.authorization(
			subcommand.metadata,
			context.interaction,
			context.config,
		);
		if (!authorization.allowed) {
			await context.interaction.reply({
				content: authorization.message,
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		await subcommand.execute(context);
	}

	async autocompleteSubcommand(group, context) {
		const subcommand = group.subcommands.get(
			context.interaction.options.getSubcommand(),
		);
		const authorization = subcommand
			? this.authorization(
				subcommand.metadata,
				context.interaction,
				context.config,
			)
			: { allowed: false };
		if (!authorization.allowed || !subcommand?.autocomplete) {
			await context.interaction.respond([]);
			return;
		}
		await subcommand.autocomplete(context);
	}

	async respondToAutocomplete(metadata, context) {
		const focused = context.interaction.options.getFocused(true);
		const option = metadata.options.find(candidate => candidate.name === focused.name);
		if (!option?.autocomplete) {
			await context.interaction.respond([]);
			return;
		}
		const completeContext = this.createContext(metadata, context);
		await context.interaction.respond(
			await getAutocompleteChoices(metadata, option, completeContext),
		);
	}

	createContext(metadata, context) {
		return {
			...context,
			locale: getLocale(context.config, context.interaction.guildId),
			metadata,
			registry: this,
		};
	}
}

function assertKnownAutocompleteProviders(metadataList) {
	for (const metadata of metadataList) {
		for (const option of metadata.options) {
			const provider = option.autocomplete?.provider;
			if (provider && !Object.hasOwn(AUTOCOMPLETE_PROVIDERS, provider)) {
				throw new Error(
					`Unknown autocomplete provider "${provider}" `
					+ `for ${metadata.id}.${option.name}.`,
				);
			}
			if (
				option.autocomplete?.showAllInHelp
				&& !Object.hasOwn(OPTION_VALUE_PROVIDERS, provider)
			) {
				throw new Error(
					`Autocomplete provider "${provider}" cannot list all values in help `
					+ `for ${metadata.id}.${option.name}.`,
				);
			}
		}
	}
}

function createRuntimeMetadata(metadata) {
	const helpDescriptionKey = metadata.help.summaryKey ?? metadata.descriptionKey;
	return {
		name: metadata.name,
		category: metadata.category,
		permission: metadata.permission,
		description: t('en', helpDescriptionKey),
		descriptionKey: helpDescriptionKey,
		usage: metadata.examples[0],
		helpOrder: metadata.help.order,
		metadata,
	};
}

function loadHandler(metadata) {
	return require(path.join(__dirname, metadata.handler));
}

function deepFreeze(value) {
	if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
		return value;
	}
	for (const child of Object.values(value)) {
		deepFreeze(child);
	}
	return Object.freeze(value);
}

const commandRegistry = new CommandRegistry(COMMAND_METADATA);

module.exports = commandRegistry;
module.exports.CommandRegistry = CommandRegistry;

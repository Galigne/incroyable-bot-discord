const fs = require('node:fs/promises');
const path = require('node:path');

const GLOBAL_CLEANUP_MIGRATION = 'global-to-guild-commands-v1';
const DEFAULT_GLOBAL_CLEANUP_MARKER_PATH = path.join(
	__dirname,
	'..',
	'.runtime',
	`${GLOBAL_CLEANUP_MIGRATION}.json`,
);

class GuildCommandRegistrationError extends Error {
	constructor(registration) {
		super(
			'Slash-command registration failed in '
			+ `${registration.failedGuildCount} guild(s).`,
		);
		this.name = 'GuildCommandRegistrationError';
		this.code = 'GUILD_COMMAND_REGISTRATION_FAILED';
		this.registration = registration;
	}
}

function buildCommandDefinitions(commandRegistry) {
	const commands = commandRegistry.getDiscordCommandData()
		.map(command => command.toJSON());
	const names = commands.map(command => command.name);
	if (new Set(names).size !== names.length) {
		throw new Error('The command registry produced duplicate command definitions.');
	}
	return commands;
}

async function registerCommands(client, commandRegistry, options = {}) {
	const commands = buildCommandDefinitions(commandRegistry);
	const logger = options.logger ?? console;
	const globalCleanup = options.removeGlobalCommands
		? await removeGlobalCommandsOnce(client, {
			logger,
			markerPath: options.globalCleanupMarkerPath,
		})
		: { completed: false, skipped: true };
	const guilds = getConnectedGuilds(client);
	const results = [];
	for (const guild of guilds) {
		results.push(await registerCommandDefinitionsForGuild(guild, commands, logger));
	}
	return summarizeRegistration(commands.length, results, globalCleanup);
}

async function registerCommandsForGuild(guild, commandRegistry, options = {}) {
	const commands = buildCommandDefinitions(commandRegistry);
	return registerCommandDefinitionsForGuild(
		guild,
		commands,
		options.logger ?? console,
	);
}

function createCommandRegistrationLifecycle({
	getCommandRegistry,
	globalCleanupMarkerPath,
	logger = console,
}) {
	let initialRegistrationPromise = null;
	let initialRegistrationSettled = false;
	const pendingGuilds = new Map();

	function handleReady(client) {
		if (!initialRegistrationPromise) {
			initialRegistrationPromise = synchronizeInitialGuilds(client)
				.finally(() => {
					initialRegistrationSettled = true;
				});
		}
		return initialRegistrationPromise;
	}

	async function handleGuildCreate(guild) {
		if (!initialRegistrationPromise) {
			pendingGuilds.set(guild.id, guild);
			return {
				guildId: guild.id,
				guildName: guild.name,
				queued: true,
				success: true,
			};
		}

		const registrationWasInProgress = !initialRegistrationSettled;
		const initialRegistration = await initialRegistrationPromise;
		if (registrationWasInProgress) {
			const existing = initialRegistration.results.find(result => (
				result.guildId === guild.id
			));
			if (existing) {
				return existing;
			}
		}
		return registerCommandsForGuild(guild, getCommandRegistry(), { logger });
	}

	async function synchronizeInitialGuilds(client) {
		const registration = await registerCommands(
			client,
			getCommandRegistry(),
			{
				globalCleanupMarkerPath,
				logger,
				removeGlobalCommands: true,
			},
		);
		const additionalResults = [];
		for (const guild of pendingGuilds.values()) {
			if (!registration.results.some(result => result.guildId === guild.id)) {
				additionalResults.push(
					await registerCommandsForGuild(
						guild,
						getCommandRegistry(),
						{ logger },
					),
				);
			}
		}
		pendingGuilds.clear();
		if (additionalResults.length === 0) {
			return registration;
		}
		return summarizeRegistration(
			registration.commandCount,
			[...registration.results, ...additionalResults],
			registration.globalCleanup,
		);
	}

	return {
		handleGuildCreate,
		handleReady,
	};
}

async function removeGlobalCommandsOnce(client, options = {}) {
	const logger = options.logger ?? console;
	const markerPath = options.markerPath ?? DEFAULT_GLOBAL_CLEANUP_MARKER_PATH;
	const applicationId = client.application?.id ?? client.user?.id;
	if (!applicationId) {
		throw new Error('The Discord application ID is unavailable.');
	}
	if (await isGlobalCleanupComplete(markerPath, applicationId)) {
		return { completed: true, skipped: true };
	}
	if (!client.application?.commands?.set) {
		throw new Error('The Discord global application command manager is unavailable.');
	}

	await client.application.commands.set([]);
	await fs.mkdir(path.dirname(markerPath), { recursive: true });
	await fs.writeFile(
		markerPath,
		`${JSON.stringify({
			applicationId,
			completedAt: new Date().toISOString(),
			migration: GLOBAL_CLEANUP_MIGRATION,
		}, null, 2)}\n`,
		'utf8',
	);
	logger.log(
		'[commands] Removed obsolete global slash commands for application '
		+ `${applicationId}.`,
	);
	return { completed: true, skipped: false };
}

function assertSuccessfulRegistration(registration) {
	if (!registration.success) {
		throw new GuildCommandRegistrationError(registration);
	}
	return registration;
}

async function registerCommandDefinitionsForGuild(guild, commands, logger) {
	const guildName = guild.name ?? 'unknown';
	try {
		if (!guild.commands?.set) {
			throw new Error('The guild command manager is unavailable.');
		}
		await guild.commands.set(commands);
		logger.log(
			`[commands] Registered ${commands.length} slash commands in guild `
			+ `${guildName} (${guild.id}).`,
		);
		return {
			commandCount: commands.length,
			guildId: guild.id,
			guildName,
			success: true,
		};
	}
	catch (error) {
		logger.error(
			'[commands] Could not register slash commands in guild '
			+ `${guildName} (${guild.id}):`,
			error,
		);
		return {
			commandCount: 0,
			error,
			guildId: guild.id,
			guildName,
			success: false,
		};
	}
}

function getConnectedGuilds(client) {
	if (!client.guilds?.cache?.values) {
		throw new Error('The Discord guild cache is unavailable.');
	}
	return [...client.guilds.cache.values()];
}

async function isGlobalCleanupComplete(markerPath, applicationId) {
	try {
		const marker = JSON.parse(await fs.readFile(markerPath, 'utf8'));
		return marker.migration === GLOBAL_CLEANUP_MIGRATION
			&& marker.applicationId === applicationId;
	}
	catch (error) {
		if (error.code === 'ENOENT' || error instanceof SyntaxError) {
			return false;
		}
		throw error;
	}
}

function summarizeRegistration(commandCount, results, globalCleanup) {
	const failedGuildCount = results.filter(result => !result.success).length;
	return {
		commandCount,
		failedGuildCount,
		globalCleanup,
		results,
		success: failedGuildCount === 0,
		successfulGuildCount: results.length - failedGuildCount,
	};
}

module.exports = {
	DEFAULT_GLOBAL_CLEANUP_MARKER_PATH,
	GLOBAL_CLEANUP_MIGRATION,
	GuildCommandRegistrationError,
	assertSuccessfulRegistration,
	buildCommandDefinitions,
	createCommandRegistrationLifecycle,
	registerCommands,
	registerCommandsForGuild,
	removeGlobalCommandsOnce,
};

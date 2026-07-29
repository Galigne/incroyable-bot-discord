const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');

const {
	GLOBAL_CLEANUP_MIGRATION,
	buildCommandDefinitions,
	createCommandRegistrationLifecycle,
	registerCommands,
} = require('../adapters/discordCommandRegistration');
const commandRegistry = require('../commands/registry');

const temporaryDirectory = fs.mkdtempSync(
	path.join(os.tmpdir(), 'incredible-bot-command-registration-'),
);

after(() => {
	fs.rmSync(temporaryDirectory, { force: true, recursive: true });
});

test('registers the complete command set in one guild without using global commands', async () => {
	let globalRegistrationCalls = 0;
	const guild = createGuild('guild-1', 'One');
	const client = createClient([guild], {
		async set() {
			globalRegistrationCalls += 1;
		},
	});

	const registration = await registerCommands(
		client,
		commandRegistry,
		{ logger: createLogger() },
	);
	const expected = buildCommandDefinitions(commandRegistry);

	assert.equal(registration.success, true);
	assert.equal(registration.successfulGuildCount, 1);
	assert.equal(globalRegistrationCalls, 0);
	assert.equal(guild.calls.length, 1);
	assert.deepEqual(guild.calls[0], expected);
});

test('builds definitions once and synchronizes the same complete set across guilds', async () => {
	const first = createGuild('guild-1', 'One');
	const second = createGuild('guild-2', 'Two');
	let buildCount = 0;
	const countingRegistry = {
		getDiscordCommandData() {
			buildCount += 1;
			return commandRegistry.getDiscordCommandData();
		},
	};

	const registration = await registerCommands(
		createClient([first, second]),
		countingRegistry,
		{ logger: createLogger() },
	);

	assert.equal(registration.success, true);
	assert.equal(registration.successfulGuildCount, 2);
	assert.equal(buildCount, 1);
	assert.equal(first.calls.length, 1);
	assert.equal(second.calls.length, 1);
	assert.equal(first.calls[0], second.calls[0]);
	assert.equal(first.calls[0].length, registration.commandCount);
});

test('continues registering other guilds when one guild fails', async () => {
	const first = createGuild('guild-1', 'One');
	const failed = createGuild('guild-2', 'Two', new Error('Missing access'));
	const third = createGuild('guild-3', 'Three');
	const logger = createLogger();

	const registration = await registerCommands(
		createClient([first, failed, third]),
		commandRegistry,
		{ logger },
	);

	assert.equal(registration.success, false);
	assert.equal(registration.successfulGuildCount, 2);
	assert.equal(registration.failedGuildCount, 1);
	assert.equal(first.calls.length, 1);
	assert.equal(failed.calls.length, 1);
	assert.equal(third.calls.length, 1);
	assert.deepEqual(
		registration.results.map(result => [result.guildId, result.success]),
		[
			['guild-1', true],
			['guild-2', false],
			['guild-3', true],
		],
	);
	assert.equal(logger.logs.length, 2);
	assert.equal(logger.errors.length, 1);
	assert.match(logger.errors[0][0], /guild Two \(guild-2\)/);
});

test('normal startup skips the global manager after migration completion', async () => {
	const applicationId = 'application-1';
	const markerPath = createMigrationMarker(applicationId, 'completed.json');
	let globalRegistrationCalls = 0;
	const guild = createGuild('guild-1', 'One');
	const client = createClient([guild], {
		async set() {
			globalRegistrationCalls += 1;
		},
	}, applicationId);

	const registration = await registerCommands(
		client,
		commandRegistry,
		{
			globalCleanupMarkerPath: markerPath,
			logger: createLogger(),
			removeGlobalCommands: true,
		},
	);

	assert.equal(registration.globalCleanup.skipped, true);
	assert.equal(globalRegistrationCalls, 0);
	assert.equal(guild.calls.length, 1);
});

test('the migration clears global commands once and only registers definitions in guilds', async () => {
	const applicationId = 'application-2';
	const markerPath = path.join(temporaryDirectory, 'new-migration.json');
	const globalPayloads = [];
	const guild = createGuild('guild-1', 'One');
	const client = createClient([guild], {
		async set(commands) {
			globalPayloads.push(commands);
		},
	}, applicationId);
	const options = {
		globalCleanupMarkerPath: markerPath,
		logger: createLogger(),
		removeGlobalCommands: true,
	};

	await registerCommands(client, commandRegistry, options);
	await registerCommands(client, commandRegistry, options);

	assert.deepEqual(globalPayloads, [[]]);
	assert.equal(guild.calls.length, 2);
	assert.ok(guild.calls.every(commands => commands.length > 0));
	assert.equal(fs.existsSync(markerPath), true);
});

test('a newly joined guild receives the latest complete command set', async () => {
	const applicationId = 'application-3';
	const markerPath = createMigrationMarker(applicationId, 'lifecycle.json');
	const existingGuild = createGuild('guild-1', 'Existing');
	const joinedGuild = createGuild('guild-2', 'Joined');
	const lifecycle = createCommandRegistrationLifecycle({
		getCommandRegistry: () => commandRegistry,
		globalCleanupMarkerPath: markerPath,
		logger: createLogger(),
	});

	await lifecycle.handleReady(createClient(
		[existingGuild],
		{ set: async () => null },
		applicationId,
	));
	const result = await lifecycle.handleGuildCreate(joinedGuild);

	assert.equal(result.success, true);
	assert.equal(existingGuild.calls.length, 1);
	assert.equal(joinedGuild.calls.length, 1);
	assert.equal(
		joinedGuild.calls[0].length,
		buildCommandDefinitions(commandRegistry).length,
	);
});

test('command definitions are unique before any guild registration', () => {
	const definitions = buildCommandDefinitions(commandRegistry);
	assert.equal(
		definitions.length,
		new Set(definitions.map(command => command.name)).size,
	);

	assert.throws(
		() => buildCommandDefinitions({
			getDiscordCommandData: () => [
				{ toJSON: () => ({ name: 'duplicate' }) },
				{ toJSON: () => ({ name: 'duplicate' }) },
			],
		}),
		/duplicate command definitions/,
	);
});

function createClient(guilds, globalCommandManager, applicationId = 'application') {
	return {
		application: {
			commands: globalCommandManager,
			id: applicationId,
		},
		guilds: {
			cache: new Map(guilds.map(guild => [guild.id, guild])),
		},
	};
}

function createGuild(id, name, failure) {
	const calls = [];
	return {
		calls,
		commands: {
			async set(commands) {
				calls.push(commands);
				if (failure) {
					throw failure;
				}
			},
		},
		id,
		name,
	};
}

function createLogger() {
	const errors = [];
	const logs = [];
	return {
		errors,
		logs,
		error: (...parts) => errors.push(parts),
		log: (...parts) => logs.push(parts),
	};
}

function createMigrationMarker(applicationId, filename) {
	const markerPath = path.join(temporaryDirectory, filename);
	fs.writeFileSync(markerPath, JSON.stringify({
		applicationId,
		migration: GLOBAL_CLEANUP_MIGRATION,
	}), 'utf8');
	return markerPath;
}

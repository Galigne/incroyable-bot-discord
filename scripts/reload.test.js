const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');
const {
	AudioPlayerStatus,
	VoiceConnectionStatus,
} = require('@discordjs/voice');
const { MessageFlags } = require('discord.js');

const { reconnectClient } = require('../adapters/discordClientLifecycle');
const { createLocalAudioManager } = require('../adapters/localAudioPlayer');
const reloadCommand = require('../commands/handlers/reload');
const commandRegistry = require('../commands/registry');
const { COMMAND_METADATA } = require('../commands/metadata');
const {
	clearGeneratorCache,
	createGeneratorCatalogCandidate,
	getGenerator,
} = require('../services/generatorCatalog');
const {
	clearStatProfileCache,
	createStatProfileCandidate,
	getStatProfile,
} = require('../services/statProfileCatalog');
const {
	DEFAULT_STAT_PROFILE_ID,
} = require('../services/generationMetadata');
const {
	getGenerationData,
	initializeGenerationData,
	reloadGenerationData,
} = require('../services/generationData');
const {
	RELOAD_STAGES,
	createRuntimeReloader,
} = require('../runtime/runtimeReloader');
const { RuntimeState } = require('../runtime/runtimeState');
const { authorizeCommand } = require('../util/authorization');
const { reloadConfig } = require('../util/configuration');
const {
	reloadTranslations,
	replaceTranslationCatalogs,
	t,
	translations,
} = require('../util/i18n');

const temporaryDirectory = fs.mkdtempSync(
	path.join(os.tmpdir(), 'incredible-bot-reload-'),
);

after(() => {
	fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

test('/reload replaces /restart metadata, localization, and routing', () => {
	const names = COMMAND_METADATA.map(metadata => metadata.name);
	assert.ok(names.includes('reload'));
	assert.equal(names.includes('restart'), false);
	assert.equal(commandRegistry.getCommand('restart'), null);
	assert.equal(commandRegistry.getRuntimeCommands().has('restart'), false);

	const metadata = commandRegistry.getCommand('reload');
	assert.equal(metadata.permission, 'moderator');
	assert.equal(metadata.handler, './handlers/reload');
	assert.equal(commandRegistry.getRuntimeCommands().has('reload'), true);
	for (const locale of ['en', 'fr']) {
		assert.equal(Object.hasOwn(translations[locale].commands, 'restart'), false);
		assert.equal(Object.hasOwn(translations[locale].commands, 'reload'), true);
		assert.notEqual(t(locale, 'commands.reload.description'), 'commands.reload.description');
	}
});

test('/reload preserves moderator permission and server-owner bypass', () => {
	const metadata = commandRegistry.getCommand('reload');
	const config = createConfig();
	assert.equal(
		authorizeCommand(
			metadata,
			createInteraction('moderator', [config.roles.moderator]),
			config,
		).allowed,
		true,
	);
	assert.equal(
		authorizeCommand(
			metadata,
			createInteraction('regular', []),
			config,
		).allowed,
		false,
	);
	assert.equal(
		authorizeCommand(
			metadata,
			createInteraction('owner', [], 'owner'),
			config,
		).allowed,
		true,
	);
});

test('configuration reload validates before replacing active state', () => {
	const configPath = path.join(temporaryDirectory, 'config.json');
	const runtimeState = createConfigState(createConfig());
	const replacement = {
		...createConfig(),
		locale: 'fr',
	};
	writeJson(configPath, replacement);
	assert.deepEqual(reloadConfig(runtimeState, configPath), replacement);
	assert.deepEqual(runtimeState.getConfig(), replacement);

	const previous = runtimeState.getConfig();
	const invalid = createConfig();
	invalid.roles.moderator = '';
	writeJson(configPath, invalid);
	assert.throws(
		() => reloadConfig(runtimeState, configPath),
		error => error.code === 'INVALID_CONFIGURATION',
	);
	assert.equal(runtimeState.getConfig(), previous);
});

test('localization reload is transactional and preserves valid catalogs on failure', () => {
	const paths = {
		en: path.join(temporaryDirectory, 'en.json'),
		fr: path.join(temporaryDirectory, 'fr.json'),
	};
	const original = structuredClone(translations);
	const candidates = structuredClone(translations);
	candidates.en.common.empty = 'Reloaded empty value';
	candidates.fr.common.empty = 'Valeur vide rechargée';
	writeJson(paths.en, candidates.en);
	writeJson(paths.fr, candidates.fr);

	try {
		reloadTranslations(paths);
		assert.equal(t('en', 'common.empty'), 'Reloaded empty value');
		assert.equal(t('fr', 'common.empty'), 'Valeur vide rechargée');

		const previousEnglish = translations.en;
		delete candidates.fr.common.empty;
		writeJson(paths.fr, candidates.fr);
		assert.throws(() => reloadTranslations(paths), /catalog/);
		assert.equal(translations.en, previousEnglish);
		assert.equal(t('en', 'common.empty'), 'Reloaded empty value');
	}
	finally {
		replaceTranslationCatalogs(original);
	}
});

test('generation-data cache clearing rebuilds both locales and statistical profiles', () => {
	const englishBefore = getGenerator('weapons', 'en');
	const frenchBefore = getGenerator('weapons', 'fr');
	const profileBefore = getStatProfile(DEFAULT_STAT_PROFILE_ID);
	clearGeneratorCache();
	clearStatProfileCache();
	assert.notEqual(getGenerator('weapons', 'en'), englishBefore);
	assert.notEqual(getGenerator('weapons', 'fr'), frenchBefore);
	assert.notEqual(getStatProfile(DEFAULT_STAT_PROFILE_ID), profileBefore);
});

test('startup, reload, and lazy generation access share one complete lifecycle', () => {
	clearGeneratorCache();
	clearStatProfileCache();
	const startupCalls = [];
	const startup = initializeGenerationData(createGenerationDataFactories(startupCalls));
	assert.deepEqual(startupCalls, ['generators', 'profiles']);
	assert.strictEqual(getGenerationData().generatorCatalog, startup.generatorCatalog);
	assert.strictEqual(getGenerationData().statProfiles, startup.statProfiles);

	const reloadCalls = [];
	const reloaded = reloadGenerationData(createGenerationDataFactories(reloadCalls));
	assert.deepEqual(reloadCalls, ['generators', 'profiles']);
	assert.strictEqual(getGenerationData().generatorCatalog, reloaded.generatorCatalog);
	assert.strictEqual(getGenerationData().statProfiles, reloaded.statProfiles);

	clearGeneratorCache();
	assert.equal(getGenerationData().generatorCatalog, null);
	assert.equal(getGenerationData().statProfiles, null);
	assert.ok(getGenerator('weapons', 'en'));
	assert.ok(getStatProfile(DEFAULT_STAT_PROFILE_ID));
	assert.ok(getGenerationData().generatorCatalog);
	assert.ok(getGenerationData().statProfiles);
});

test('failed generation-data preparation preserves the previously published pair', () => {
	const previous = getGenerationData();
	const invalidProfiles = createStatProfileCandidate();
	invalidProfiles.delete(DEFAULT_STAT_PROFILE_ID);

	assert.throws(
		() => reloadGenerationData({
			createGeneratorCatalogCandidate,
			createStatProfileCandidate: () => invalidProfiles,
		}),
		error => error.code === 'BACKGROUND_STAT_PROFILE_MISSING',
	);
	assert.strictEqual(getGenerationData(), previous);
	assert.strictEqual(
		getGenerator('weapons', 'en'),
		previous.generatorCatalog.get('en').get('weapons'),
	);
	assert.strictEqual(
		getStatProfile(DEFAULT_STAT_PROFILE_ID),
		previous.statProfiles.get(DEFAULT_STAT_PROFILE_ID),
	);

	assert.throws(
		() => initializeGenerationData({
			createGeneratorCatalogCandidate,
			createStatProfileCandidate: () => {
				throw new Error('profile candidate failed');
			},
		}),
		/profile candidate failed/,
	);
	assert.strictEqual(getGenerationData(), previous);
});

test('command registry replacement is atomic and does not duplicate commands or listeners', () => {
	const client = new EventEmitter();
	const listener = () => null;
	client.on('interaction', listener);
	const runtimeState = new RuntimeState(client, {
		commandRegistry,
		config: createConfig(),
	});
	const originalRegistry = runtimeState.getCommandRegistry();

	commandRegistry.reloadCommandRegistry(runtimeState);
	assert.notEqual(runtimeState.getCommandRegistry(), originalRegistry);
	assert.equal(client.commandRegistry, runtimeState.getCommandRegistry());
	assert.equal(client.commands, runtimeState.getCommandRegistry().getRuntimeCommands());
	assert.equal(client.listenerCount('interaction'), 1);
	assert.equal(
		client.commands.size,
		new Set(client.commands.keys()).size,
	);

	commandRegistry.reloadCommandRegistry(runtimeState);
	assert.equal(client.listenerCount('interaction'), 1);
	assert.equal(
		client.commands.size,
		COMMAND_METADATA.filter(metadata => !metadata.parent).length,
	);
});

test('voice cleanup stops players and destroys active connections', async () => {
	const connection = {
		destroyCount: 0,
		state: { status: VoiceConnectionStatus.Ready },
		destroy() {
			this.destroyCount += 1;
			this.state.status = VoiceConnectionStatus.Destroyed;
		},
		subscribe() {
			return null;
		},
	};
	class FakePlayer extends EventEmitter {
		play() {
			return null;
		}

		stop() {
			this.emit(AudioPlayerStatus.Idle);
			return true;
		}
	}
	const manager = createLocalAudioManager({
		createAudioPlayer: () => new FakePlayer(),
		createAudioResource: audioFile => ({ audioFile }),
		entersState: async () => connection,
		joinVoiceChannel: () => connection,
	});
	const playback = manager.play(
		{
			guild: {
				id: 'guild',
				voiceAdapterCreator: {},
			},
			id: 'voice',
		},
		'audio.mp3',
	);
	await new Promise(resolve => setImmediate(resolve));
	assert.deepEqual(manager.getActiveResourceCounts(), {
		connections: 1,
		players: 1,
	});

	manager.disconnectAll();
	await playback;
	assert.deepEqual(manager.getActiveResourceCounts(), {
		connections: 0,
		players: 0,
	});
	assert.equal(connection.destroyCount, 1);
});

test('Discord reconnect reuses the client without duplicating listeners', async () => {
	const client = new EventEmitter();
	const calls = [];
	const diagnosticLogs = [];
	let resolveDestruction;
	const destruction = new Promise(resolve => {
		resolveDestruction = resolve;
	});
	client.destroy = () => {
		calls.push('destroy');
		return destruction;
	};
	client.login = async token => calls.push(`login:${token}`);
	client.on('interaction', () => null);
	const originalClient = client;

	const reconnect = reconnectClient(client, 'test-token', {
		log: message => diagnosticLogs.push(message),
	});
	await new Promise(resolve => setImmediate(resolve));
	assert.deepEqual(calls, ['destroy']);
	assert.deepEqual(diagnosticLogs, [
		'[reload] discordReconnect: destruction invoked.',
	]);

	resolveDestruction();
	await reconnect;
	assert.equal(client, originalClient);
	assert.deepEqual(calls, ['destroy', 'login:test-token']);
	assert.equal(client.listenerCount('interaction'), 1);
	assert.deepEqual(diagnosticLogs, [
		'[reload] discordReconnect: destruction invoked.',
		'[reload] discordReconnect: destruction completed.',
		'[reload] discordReconnect: login beginning.',
		'[reload] discordReconnect: login completed.',
	]);
});

test('failed destruction prevents login and fails the discord reconnect stage', async () => {
	const client = new EventEmitter();
	const calls = [];
	const diagnosticLogs = [];
	let rejectDestruction;
	const destruction = new Promise((resolve, reject) => {
		rejectDestruction = reject;
	});
	client.destroy = () => {
		calls.push('destroy');
		return destruction;
	};
	client.login = async token => calls.push(`login:${token}`);
	client.on('interaction', () => null);
	const originalClient = client;
	const logged = [];
	const runtimeState = {
		getConfig: () => ({ locale: 'en' }),
	};
	const operations = Object.fromEntries(
		RELOAD_STAGES
			.filter(id => id !== 'discordReconnect')
			.map(id => [id, async () => undefined]),
	);
	const runtimeReloader = createRuntimeReloader({
		client,
		discordToken: 'startup-token',
		logger: {
			log: message => diagnosticLogs.push(message),
			error: (...parts) => logged.push(parts),
		},
		operations,
		runtimeState,
	});

	const destructionError = new Error('destroy failed');
	const reload = runtimeReloader.reload();
	await new Promise(resolve => setImmediate(resolve));
	assert.deepEqual(calls, ['destroy']);
	rejectDestruction(destructionError);
	const outcome = await reload;

	assert.equal(client, originalClient);
	assert.equal(client.listenerCount('interaction'), 1);
	assert.deepEqual(calls, ['destroy']);
	assert.equal(outcome.success, false);
	assert.deepEqual(
		outcome.stages.filter(stage => !stage.success).map(stage => stage.id),
		['discordReconnect'],
	);
	assert.deepEqual(logged, [[
		'[reload] discordReconnect failed:',
		destructionError,
	]]);
	assert.equal(
		diagnosticLogs.includes('[reload] discordReconnect: login beginning.'),
		false,
	);
	assert.equal(
		diagnosticLogs.includes('[reload] discordReconnect: destruction completed.'),
		false,
	);
	assert.equal(diagnosticLogs.at(-1), '[reload] lifecycle finished.');
});

test('/reload validates a changed token but reconnects with the startup token', async () => {
	const configPath = path.join(temporaryDirectory, 'restart-only-token.json');
	const runtimeState = createConfigState(createConfig());
	const replacement = {
		...createConfig(),
		discordToken: 'changed-config-token',
		locale: 'fr',
	};
	writeJson(configPath, replacement);
	const loginTokens = [];
	const client = {
		destroy: () => undefined,
		login: async discordToken => loginTokens.push(discordToken),
	};
	const operations = Object.fromEntries(
		RELOAD_STAGES
			.filter(id => !['configuration', 'discordReconnect'].includes(id))
			.map(id => [id, async () => undefined]),
	);
	const runtimeReloader = createRuntimeReloader({
		client,
		configPath,
		discordToken: 'startup-token',
		logger: createSilentLogger(),
		operations,
		runtimeState,
	});

	const outcome = await runtimeReloader.reload();

	assert.equal(outcome.success, true);
	assert.deepEqual(runtimeState.getConfig(), replacement);
	assert.deepEqual(loginTokens, ['startup-token']);
});

test('runtime reload reports a failed registration and continues later stages', async () => {
	const calls = [];
	const diagnosticLogs = [];
	const logged = [];
	const runtimeState = {
		getConfig: () => ({ locale: 'en' }),
	};
	const operations = Object.fromEntries(RELOAD_STAGES.map(id => [
		id,
		async () => {
			calls.push(id);
			if (id === 'registration') {
				throw new Error('registration failed');
			}
		},
	]));
	const runtimeReloader = createRuntimeReloader({
		client: {},
		discordToken: 'sensitive-token',
		logger: {
			log: message => diagnosticLogs.push(message),
			error: (...parts) => logged.push(parts),
		},
		operations,
		runtimeState,
	});
	const outcome = await runtimeReloader.reload();

	assert.deepEqual(calls, RELOAD_STAGES);
	assert.equal(outcome.success, false);
	assert.deepEqual(
		outcome.stages.filter(stage => !stage.success).map(stage => stage.id),
		['registration'],
	);
	assert.equal(logged.length, 1);
	assert.equal(logged[0][0], '[reload] registration failed:');
	const expectedDiagnosticLogs = ['[reload] lifecycle started.'];
	for (const id of RELOAD_STAGES) {
		expectedDiagnosticLogs.push(`[reload] stage ${id} starting.`);
		if (id !== 'registration') {
			expectedDiagnosticLogs.push(`[reload] stage ${id} completed.`);
		}
	}
	expectedDiagnosticLogs.push('[reload] lifecycle finished.');
	assert.deepEqual(diagnosticLogs, expectedDiagnosticLogs);
	assert.equal(JSON.stringify(outcome).includes('sensitive-token'), false);
	assert.equal(calls.includes('discordReconnect'), true);
});

test('concurrent reload requests share one stage run', async () => {
	let operationCount = 0;
	const operations = Object.fromEntries(RELOAD_STAGES.map(id => [
		id,
		async () => {
			operationCount += 1;
			await new Promise(resolve => setImmediate(resolve));
		},
	]));
	const runtimeReloader = createRuntimeReloader({
		client: {},
		discordToken: 'test-token',
		logger: createSilentLogger(),
		operations,
		runtimeState: {
			getConfig: () => ({ locale: 'en' }),
		},
	});

	const [first, second] = await Promise.all([
		runtimeReloader.reload(),
		runtimeReloader.reload(),
	]);
	assert.equal(first, second);
	assert.equal(operationCount, RELOAD_STAGES.length);
});

test('/reload acknowledges ephemerally before running stages and returns a summary', async () => {
	const calls = [];
	const interaction = {
		async editReply(response) {
			calls.push(['edit', response]);
		},
		async reply(response) {
			calls.push(['reply', response]);
		},
	};
	const runtimeReloader = {
		async reload() {
			assert.equal(calls[0][0], 'reply');
			calls.push(['reload']);
			return {
				locale: 'en',
				stages: RELOAD_STAGES.map(id => ({ id, success: true })),
				success: true,
			};
		},
	};

	await reloadCommand.execute({
		interaction,
		locale: 'en',
		runtimeReloader,
	});
	assert.deepEqual(calls.map(call => call[0]), ['reply', 'reload', 'edit']);
	assert.equal(calls[0][1].flags, MessageFlags.Ephemeral);
	assert.match(calls[0][1].content, /reload started/i);
	assert.match(calls[2][1].content, /Reload complete/);
	assert.match(calls[2][1].content, /Discord reconnect/);
});

function createConfig() {
	return {
		botUserId: 'bot',
		discordToken: 'test-config-token',
		locale: 'en',
		roles: {
			dm: 'dm-role',
			moderator: 'moderator-role',
		},
	};
}

function createConfigState(initialConfig) {
	let activeConfig = initialConfig;
	return {
		getConfig: () => activeConfig,
		replaceConfig: replacement => {
			activeConfig = replacement;
		},
	};
}

function createInteraction(userId, roleIds, ownerId = 'owner') {
	return {
		guild: { ownerId },
		guildId: 'guild',
		member: {
			roles: {
				cache: {
					has: roleId => roleIds.includes(roleId),
				},
			},
		},
		user: { id: userId },
	};
}

function writeJson(filePath, value) {
	fs.writeFileSync(filePath, JSON.stringify(value), 'utf8');
}

function createGenerationDataFactories(calls) {
	return {
		createGeneratorCatalogCandidate: () => {
			calls.push('generators');
			return createGeneratorCatalogCandidate();
		},
		createStatProfileCandidate: () => {
			calls.push('profiles');
			return createStatProfileCandidate();
		},
	};
}

function createSilentLogger() {
	return {
		error: () => undefined,
		log: () => undefined,
	};
}

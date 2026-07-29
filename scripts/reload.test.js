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
const reloadCommand = require('../commands/reload');
const commandRegistry = require('../commands/registry');
const { COMMAND_METADATA } = require('../commands/metadata');
const {
	clearGeneratorCache,
	getGenerator,
} = require('../services/generatorCatalog');
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
	assert.equal(metadata.handler, './reload');
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
	delete invalid.roles.moderator;
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

test('generator reload clears both localized caches', () => {
	const englishBefore = getGenerator('weapons', 'en');
	const frenchBefore = getGenerator('weapons', 'fr');
	clearGeneratorCache();
	assert.notEqual(getGenerator('weapons', 'en'), englishBefore);
	assert.notEqual(getGenerator('weapons', 'fr'), frenchBefore);
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
	client.destroy = () => calls.push('destroy');
	client.login = async token => calls.push(`login:${token}`);
	client.on('interaction', () => null);
	const originalClient = client;

	await reconnectClient(client, 'test-token');
	assert.equal(client, originalClient);
	assert.deepEqual(calls, ['destroy', 'login:test-token']);
	assert.equal(client.listenerCount('interaction'), 1);
});

test('runtime reload reports a failed registration and continues later stages', async () => {
	const calls = [];
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
		logger: {
			error: (...parts) => logged.push(parts),
		},
		operations,
		runtimeState,
		token: 'sensitive-token',
	});
	const outcome = await runtimeReloader.reload();

	assert.deepEqual(calls, RELOAD_STAGES);
	assert.equal(outcome.success, false);
	assert.deepEqual(
		outcome.stages.filter(stage => !stage.success).map(stage => stage.id),
		['registration'],
	);
	assert.equal(logged.length, 1);
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
		operations,
		runtimeState: {
			getConfig: () => ({ locale: 'en' }),
		},
		token: 'test-token',
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

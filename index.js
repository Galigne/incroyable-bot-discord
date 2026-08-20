const path = require('node:path');
const process = require('node:process');
const { Events } = require('discord.js');
const {
	createCommandRegistrationLifecycle,
} = require('./adapters/discordCommandRegistration');
const Client = require('./client/Client');
const commandRegistry = require('./commands/registry');
const { handleEntityInteraction } = require('./commands/entity/interactions');
const { playLocalAudio } = require('./adapters/localAudioPlayer');
const { createInteractionHandler } = require('./runtime/interactionHandler');
const { createRuntimeReloader } = require('./runtime/runtimeReloader');
const { RuntimeState } = require('./runtime/runtimeState');
const { createVoiceStateHandler } = require('./runtime/voiceStateHandler');
const { initializeGenerationData } = require('./services/generationData');
const { authorizeCommand } = require('./util/authorization');
const {
	getConfigurationErrorMessage,
	loadConfig,
} = require('./util/configuration');

const client = new Client();
const runtimeState = new RuntimeState(client, {
	commandRegistry,
	config: {},
});
const commandRegistrationLifecycle = createCommandRegistrationLifecycle({
	getCommandRegistry: () => runtimeState.getCommandRegistry(),
});

client.once(Events.ClientReady, async readyClient => {
	console.log(`Logged in as ${readyClient.user.tag}.`);
	try {
		const registration = await commandRegistrationLifecycle.handleReady(readyClient);
		if (!registration.success) {
			console.error(
				'Could not register slash commands in '
				+ `${registration.failedGuildCount} guild(s).`,
			);
		}
	}
	catch (error) {
		console.error('Could not initialize guild slash-command registration:', error);
	}
});

client.on(Events.GuildCreate, async guild => {
	try {
		await commandRegistrationLifecycle.handleGuildCreate(guild);
	}
	catch (error) {
		console.error(
			'Could not synchronize slash commands after joining guild '
			+ `${guild.name ?? 'unknown'} (${guild.id}):`,
			error,
		);
	}
});

client.on(Events.ShardReconnecting, shardId => {
	console.log(`Shard ${shardId} is reconnecting.`);
});

client.on(Events.ShardDisconnect, (event, shardId) => {
	console.log(`Shard ${shardId} disconnected with code ${event.code}.`);
});

client.on(Events.VoiceStateUpdate, createVoiceStateHandler({
	audioPath: path.join(__dirname, 'media', 'Poutouyemoun.mp3'),
	getConfig: () => runtimeState.getConfig(),
	playLocalAudio,
}));

async function start() {
	let startupConfig;
	try {
		startupConfig = loadConfig();
		runtimeState.replaceConfig(startupConfig);
	}
	catch (error) {
		console.error(getConfigurationErrorMessage(error, runtimeState.getConfig()));
		process.exitCode = 1;
		return;
	}
	try {
		initializeGenerationData();
	}
	catch (error) {
		console.error('Could not initialize generation data:', error);
		process.exitCode = 1;
		return;
	}

	const startupDiscordToken = startupConfig.discordToken.trim();
	const runtimeReloader = createRuntimeReloader({
		client,
		discordToken: startupDiscordToken,
		runtimeState,
	});
	client.on(Events.InteractionCreate, createInteractionHandler({
		authorizeCommand,
		client,
		getConfig: () => runtimeState.getConfig(),
		handleEntityInteraction,
		runtimeReloader,
	}));

	try {
		await client.login(startupDiscordToken);
	}
	catch (error) {
		if (error.code === 'TokenInvalid') {
			console.error(
				'Discord rejected the token. Reset it in the Developer Portal, '
				+ 'then update discordToken in config.json and restart the bot.',
			);
		}
		else {
			console.error('The bot failed to start:', error);
		}
		process.exitCode = 1;
	}
}

start();

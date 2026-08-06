const fs = require('node:fs');
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
const { authorizeCommand } = require('./util/authorization');
const {
	getConfigurationErrorMessage,
	loadConfig,
} = require('./util/configuration');

loadEnvironment();

const token = process.env.DISCORD_TOKEN?.trim();
const client = new Client();
const runtimeState = new RuntimeState(client, {
	commandRegistry,
	config: {},
});
const runtimeReloader = createRuntimeReloader({
	client,
	runtimeState,
	token,
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

client.on(Events.InteractionCreate, createInteractionHandler({
	authorizeCommand,
	client,
	getConfig: () => runtimeState.getConfig(),
	handleEntityInteraction,
	runtimeReloader,
	token,
}));

client.on(Events.VoiceStateUpdate, createVoiceStateHandler({
	audioPath: path.join(__dirname, 'media', 'Poutouyemoun.mp3'),
	getConfig: () => runtimeState.getConfig(),
	playLocalAudio,
}));

async function start() {
	try {
		runtimeState.replaceConfig(loadConfig());
	}
	catch (error) {
		console.error(getConfigurationErrorMessage(error, runtimeState.getConfig()));
		process.exitCode = 1;
		return;
	}

	if (!token || token === 'paste_your_new_token_here') {
		console.error(
			'DISCORD_TOKEN is missing. Copy .env.example to .env, '
			+ 'then add a token generated in the Discord Developer Portal.',
		);
		process.exitCode = 1;
		return;
	}

	try {
		await client.login(token);
	}
	catch (error) {
		if (error.code === 'TokenInvalid') {
			console.error(
				'Discord rejected the token. Reset it in the Developer Portal, '
				+ 'then update DISCORD_TOKEN in .env.',
			);
		}
		else {
			console.error('The bot failed to start:', error);
		}
		process.exitCode = 1;
	}
}

function loadEnvironment() {
	const envFile = path.join(__dirname, '.env');
	if (fs.existsSync(envFile) && typeof process.loadEnvFile === 'function') {
		process.loadEnvFile(envFile);
	}
}

start();

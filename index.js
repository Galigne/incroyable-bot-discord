const fs = require('node:fs');
const path = require('node:path');
const process = require('node:process');
const { Events, MessageFlags } = require('discord.js');
const {
	createCommandRegistrationLifecycle,
} = require('./adapters/discordCommandRegistration');
const Client = require('./client/Client');
const commandRegistry = require('./commands/registry');
const { handleEntityInteraction } = require('./commands/character/interactions');
const initialConfig = require('./config.json');
const { playLocalAudio } = require('./adapters/localAudioPlayer');
const { createRuntimeReloader } = require('./runtime/runtimeReloader');
const { RuntimeState } = require('./runtime/runtimeState');
const { authorizeCommand } = require('./util/authorization');
const {
	getConfigurationErrorMessage,
	validateConfig,
} = require('./util/configuration');
const { getLocale, t } = require('./util/i18n');

loadEnvironment();

const token = process.env.DISCORD_TOKEN?.trim();
const client = new Client();
const runtimeState = new RuntimeState(client, {
	commandRegistry,
	config: initialConfig,
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

client.on(Events.InteractionCreate, async interaction => {
	const config = runtimeState.getConfig();
	if (!interaction.inGuild()) {
		if (interaction.isAutocomplete()) {
			await interaction.respond([]).catch(ignoreRejection);
		}
		else if (interaction.isRepliable()) {
			await interaction.reply({
				content: t(getLocale(config), 'authorization.guildOnly'),
				flags: MessageFlags.Ephemeral,
			}).catch(ignoreRejection);
		}
		return;
	}

	if (interaction.isModalSubmit()) {
		try {
			if (await handleEntityInteraction(interaction, config)) {
				return;
			}
		}
		catch (error) {
			console.error(`Error while handling component ${interaction.customId}:`, error);
			await replyWithUnexpectedError(interaction);
		}
		return;
	}

	const command = client.commands.get(interaction.commandName);
	if (!command) {
		return;
	}

	if (interaction.isAutocomplete()) {
		try {
			const authorization = authorizeCommand(command, interaction, config);
			if (!authorization.allowed || !command.autocomplete) {
				await interaction.respond([]);
				return;
			}
			await command.autocomplete({ client, config, interaction });
		}
		catch (error) {
			console.error(`Autocomplete failed for /${interaction.commandName}:`, error);
			await interaction.respond([]).catch(ignoreRejection);
		}
		return;
	}

	if (!interaction.isChatInputCommand()) {
		return;
	}

	const authorization = authorizeCommand(command, interaction, config);
	if (!authorization.allowed) {
		if (authorization.message) {
			await interaction.reply({
				content: authorization.message,
				flags: MessageFlags.Ephemeral,
			});
		}
		return;
	}

	try {
		await command.execute({
			client,
			config,
			interaction,
			runtimeReloader,
			token,
		});
	}
	catch (error) {
		console.error(`Error while running /${interaction.commandName}:`, error);
		await replyWithUnexpectedError(interaction);
	}
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
	const config = runtimeState.getConfig();
	if (
		oldState.channelId !== null
		|| newState.channelId !== config.channels?.teamVoice
		|| oldState.member.id === config.botUserId
	) {
		return;
	}

	try {
		await playLocalAudio(
			newState.channel,
			path.join(__dirname, 'media', 'Poutouyemoun.mp3'),
		);
	}
	catch (error) {
		console.error('Could not play Poutouyemoun.mp3:', error);
	}
});

async function start() {
	try {
		validateConfig(runtimeState.getConfig());
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

async function replyWithUnexpectedError(interaction) {
	const locale = getLocale(runtimeState.getConfig(), interaction.guildId);
	const response = {
		content: t(locale, 'common.unexpectedError'),
		flags: MessageFlags.Ephemeral,
	};
	if (interaction.replied || interaction.deferred) {
		await interaction.followUp(response).catch(ignoreRejection);
	}
	else {
		await interaction.reply(response).catch(ignoreRejection);
	}
}

function ignoreRejection() {
	// The original Discord request may already be closed; the failure is non-actionable.
}

start();

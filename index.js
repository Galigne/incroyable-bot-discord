const fs = require('node:fs');
const path = require('node:path');
const process = require('node:process');
const { Events, MessageFlags } = require('discord.js');
const Client = require('./client/Client');
const { handleRpgInteraction } = require('./commands/rpg/interactions');
const config = require('./config.json');
const { playLocalAudio } = require('./services/localAudioPlayer');
const { authorizeCommand } = require('./util/authorization');
const { loadCommands } = require('./util/loadCommands');

loadEnvironment();

const token = process.env.DISCORD_TOKEN?.trim();
const client = new Client();
client.commands = loadCommands(path.join(__dirname, 'commands'));

client.once(Events.ClientReady, async readyClient => {
	console.log(`Logged in as ${readyClient.user.tag}.`);
	try {
		await readyClient.application.commands.set(
			[...readyClient.commands.values()].map(command => command.data.toJSON()),
		);
		console.log(`Registered ${readyClient.commands.size} global slash commands.`);
	}
	catch (error) {
		console.error('Could not register slash commands:', error);
	}
});

client.on(Events.ShardReconnecting, shardId => {
	console.log(`Shard ${shardId} is reconnecting.`);
});

client.on(Events.ShardDisconnect, (event, shardId) => {
	console.log(`Shard ${shardId} disconnected with code ${event.code}.`);
});

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.inGuild()) {
		return;
	}

	if (interaction.isModalSubmit()) {
		try {
			if (await handleRpgInteraction(interaction, config)) {
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
			await interaction.respond([]).catch(() => {});
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
			token,
		});
	}
	catch (error) {
		console.error(`Error while running /${interaction.commandName}:`, error);
		await replyWithUnexpectedError(interaction);
	}
});

client.on(Events.GuildMemberAdd, async guildMember => {
	try {
		await guildMember.roles.add(config.roles.newMember);
	}
	catch (error) {
		console.error('Could not assign the new-member role:', error);
	}
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
	if (
		oldState.channelId !== null
		|| newState.channelId !== config.channels.teamVoice
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
	const response = {
		content: 'Something went wrong while running that command.',
		flags: MessageFlags.Ephemeral,
	};
	if (interaction.replied || interaction.deferred) {
		await interaction.followUp(response).catch(() => {});
	}
	else {
		await interaction.reply(response).catch(() => {});
	}
}

start();

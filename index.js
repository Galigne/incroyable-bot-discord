const fs = require('node:fs');
const path = require('node:path');
const process = require('node:process');
const { Events } = require('discord.js');
const Client = require('./client/Client');
const config = require('./config.json');
const { playLocalAudio } = require('./services/localAudioPlayer');
const { authorizeCommand } = require('./util/authorization');
const { loadCommands } = require('./util/loadCommands');

loadEnvironment();

const token = process.env.DISCORD_TOKEN?.trim();
const client = new Client();
client.commands = loadCommands(path.join(__dirname, 'commands'));

client.once(Events.ClientReady, readyClient => {
	console.log(`Logged in as ${readyClient.user.tag}.`);
});

client.on(Events.ShardReconnecting, shardId => {
	console.log(`Shard ${shardId} is reconnecting.`);
});

client.on(Events.ShardDisconnect, (event, shardId) => {
	console.log(`Shard ${shardId} disconnected with code ${event.code}.`);
});

client.on(Events.MessageCreate, async message => {
	if (message.author.bot || !message.inGuild() || !message.content.startsWith(config.prefix)) {
		return;
	}

	const args = message.content.slice(config.prefix.length).trim().split(/\s+/);
	const commandName = args.shift()?.toLowerCase();
	if (!commandName) {
		return;
	}

	const command = client.commands.get(commandName);
	if (!command) {
		return;
	}

	const authorization = authorizeCommand(command, message, config);
	if (!authorization.allowed) {
		if (authorization.message) {
			await message.reply(authorization.message);
		}
		return;
	}

	try {
		await command.execute({
			args,
			client,
			config,
			message,
			token,
		});
	}
	catch (error) {
		console.error(`Error while running the ${commandName} command:`, error);
		await message.reply('Something went wrong while running that command.').catch(() => {});
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

start();

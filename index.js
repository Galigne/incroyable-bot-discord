const fs = require('node:fs');
const path = require('node:path');
const process = require('node:process');
const {
	Collection,
	Events,
} = require('discord.js');
const {
	AudioPlayerStatus,
	createAudioPlayer,
	createAudioResource,
	joinVoiceChannel,
} = require('@discordjs/voice');
const Client = require('./client/Client');
const config = require('./config.json');

const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile) && typeof process.loadEnvFile === 'function') {
	process.loadEnvFile(envFile);
}

const token = process.env.DISCORD_TOKEN?.trim();
const {
	prefix,
	uneIncroyableMerde,
	uneIncroyablePersonne,
	unIncroyableModerateur,
	unIncroyableBot,
	lePlusIncroyable,
	cmd,
	musiques,
	equipe_voice,
} = config;

const client = new Client();
client.commands = new Collection();

const commandFiles = fs.readdirSync(path.join(__dirname, 'commands'))
	.filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const command = require(path.join(__dirname, 'commands', file));
	if (!command.name || typeof command.execute !== 'function') {
		throw new Error(`La commande ${file} doit exposer un nom et une fonction execute().`);
	}
	client.commands.set(command.name.toLowerCase(), command);
}

client.once(Events.ClientReady, readyClient => {
	console.log(`Connecté en tant que ${readyClient.user.tag}.`);
});

client.on(Events.ShardReconnecting, shardId => {
	console.log(`Reconnexion du shard ${shardId}…`);
});

client.on(Events.ShardDisconnect, (event, shardId) => {
	console.log(`Shard ${shardId} déconnecté (code ${event.code}).`);
});

client.on(Events.MessageCreate, async message => {
	if (message.author.bot || !message.inGuild() || !message.content.startsWith(prefix)) {
		return;
	}

	const args = message.content.slice(prefix.length).trim().split(/\s+/);
	const commandName = args.shift()?.toLowerCase();
	const command = client.commands.get(commandName);
	if (!command) {
		return;
	}

	const hasRole = (...roleIds) => message.member.roles.cache
		.some(role => roleIds.includes(role.id));

	if (!hasRole(lePlusIncroyable, unIncroyableModerateur, uneIncroyablePersonne)) {
		return;
	}

	try {
		if (commandName === 'purge') {
			if (!hasRole(lePlusIncroyable)) {
				await message.reply('Tu n’es pas assez incroyable pour utiliser cette commande.');
				return;
			}
			await command.execute(message);
		}
		else if (['play', 'skip', 'stop'].includes(commandName)) {
			if (![cmd, musiques].includes(message.channel.id)) {
				await message.reply('Cette commande doit être utilisée dans le salon des_incroyables_musiques.');
				await message.delete().catch(() => {});
				return;
			}
			await command.execute(message);
		}
		else if (commandName === 'restart') {
			if (message.channel.id !== cmd || !hasRole(lePlusIncroyable)) {
				await message.reply('Vous n’avez pas accès à cette commande.');
				await message.delete().catch(() => {});
				return;
			}
			await command.execute(message, client, token);
		}
		else if (commandName === 'say') {
			if (!hasRole(lePlusIncroyable, unIncroyableModerateur)) {
				await message.reply('Vous n’avez pas accès à cette commande.');
				await message.delete().catch(() => {});
				return;
			}
			await command.execute(message);
		}
		else if (commandName === 'help') {
			await command.execute(message, client);
		}
		else {
			await command.execute(message);
		}
	}
	catch (error) {
		console.error(`Erreur pendant la commande ${commandName}:`, error);
		await message.reply('Il y a eu une erreur 🙃').catch(() => {});
	}
});

client.on(Events.GuildMemberAdd, async guildMember => {
	try {
		await guildMember.roles.add(uneIncroyableMerde);
	}
	catch (error) {
		console.error('Impossible d’ajouter le rôle au nouveau membre:', error);
	}
});

client.on(Events.VoiceStateUpdate, (oldState, newState) => {
	if (
		oldState.channelId !== null
		|| newState.channelId !== equipe_voice
		|| oldState.member.id === unIncroyableBot
	) {
		return;
	}

	const connection = joinVoiceChannel({
		channelId: newState.channel.id,
		guildId: newState.guild.id,
		adapterCreator: newState.guild.voiceAdapterCreator,
	});
	const player = createAudioPlayer();
	const resource = createAudioResource(path.join(__dirname, 'media', 'Poutouyemoun.mp3'));

	connection.subscribe(player);
	player.play(resource);
	player.once(AudioPlayerStatus.Idle, () => connection.destroy());
	player.once('error', error => {
		console.error('Erreur de lecture de Poutouyemoun.mp3:', error);
		connection.destroy();
	});
});

async function start() {
	if (!token || token === 'collez_votre_nouveau_token_ici') {
		console.error(
			'DISCORD_TOKEN est absent. Copiez .env.example vers .env, '
			+ 'puis ajoutez un nouveau token généré dans le portail développeur Discord.',
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
				'Discord refuse ce token. Réinitialisez-le dans le portail développeur, '
				+ 'puis remplacez DISCORD_TOKEN dans .env.',
			);
		}
		else {
			console.error('Échec du démarrage du bot:', error);
		}
		process.exitCode = 1;
	}
}

start();

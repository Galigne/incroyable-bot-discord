const {
	AudioPlayerStatus,
	NoSubscriberBehavior,
	StreamType,
	VoiceConnectionStatus,
	createAudioPlayer,
	createAudioResource,
	entersState,
	joinVoiceChannel,
} = require('@discordjs/voice');
const ytdl = require('ytdl-core');

const CONNECTION_TIMEOUT = 20_000;

module.exports = {
	name: 'play',
	description: 'Joue de la musique dans un salon vocal',
	async execute(message) {
		const url = message.content.trim().split(/\s+/)[1];
		const voiceChannel = message.member.voice.channel;

		if (!voiceChannel) {
			await message.channel.send('Tu dois être dans un salon vocal pour jouer de la musique.');
			return;
		}
		if (!url || !ytdl.validateURL(url)) {
			await message.channel.send('Donne une URL YouTube valide après la commande.');
			return;
		}

		const songInfo = await ytdl.getInfo(url);
		const song = {
			title: songInfo.videoDetails.title,
			url: songInfo.videoDetails.video_url,
		};
		let serverQueue = message.client.queue.get(message.guild.id);

		if (serverQueue) {
			serverQueue.songs.push(song);
			await message.channel.send(`**${song.title}** a été ajouté à la liste d’attente.`);
			return;
		}

		const connection = joinVoiceChannel({
			channelId: voiceChannel.id,
			guildId: voiceChannel.guild.id,
			adapterCreator: voiceChannel.guild.voiceAdapterCreator,
		});
		const player = createAudioPlayer({
			behaviors: {
				noSubscriber: NoSubscriberBehavior.Pause,
			},
		});

		serverQueue = {
			connection,
			player,
			songs: [song],
			textChannel: message.channel,
		};
		message.client.queue.set(message.guild.id, serverQueue);
		connection.subscribe(player);

		player.on(AudioPlayerStatus.Idle, async () => {
			serverQueue.songs.shift();
			await playNext(message.client, message.guild.id);
		});
		player.on('error', async error => {
			console.error('Erreur du lecteur audio:', error);
			await serverQueue.textChannel
				.send(`Impossible de lire cette musique : ${error.message}`)
				.catch(() => {});
			serverQueue.songs.shift();
			await playNext(message.client, message.guild.id);
		});

		try {
			await entersState(connection, VoiceConnectionStatus.Ready, CONNECTION_TIMEOUT);
			await playNext(message.client, message.guild.id);
		}
		catch (error) {
			cleanup(message.client, message.guild.id);
			throw new Error(`Impossible de rejoindre le salon vocal : ${error.message}`);
		}
	},
};

async function playNext(client, guildId) {
	const serverQueue = client.queue.get(guildId);
	if (!serverQueue) {
		return;
	}

	const song = serverQueue.songs[0];
	if (!song) {
		cleanup(client, guildId);
		return;
	}

	const stream = ytdl(song.url, {
		filter: 'audioonly',
		highWaterMark: 1 << 25,
		quality: 'highestaudio',
	});
	const resource = createAudioResource(stream, {
		inputType: StreamType.Arbitrary,
	});

	serverQueue.player.play(resource);
	await serverQueue.textChannel.send(`Lecture de **${song.title}**.`);
}

function cleanup(client, guildId) {
	const serverQueue = client.queue.get(guildId);
	if (!serverQueue) {
		return;
	}

	if (serverQueue.connection.state.status !== VoiceConnectionStatus.Destroyed) {
		serverQueue.connection.destroy();
	}
	client.queue.delete(guildId);
}

const {
	AudioPlayerStatus,
	VoiceConnectionStatus,
	createAudioPlayer,
	createAudioResource,
	entersState,
	joinVoiceChannel,
} = require('@discordjs/voice');

const CONNECTION_TIMEOUT = 20_000;

async function playLocalAudio(voiceChannel, audioFile) {
	const connection = joinVoiceChannel({
		channelId: voiceChannel.id,
		guildId: voiceChannel.guild.id,
		adapterCreator: voiceChannel.guild.voiceAdapterCreator,
	});

	try {
		await entersState(
			connection,
			VoiceConnectionStatus.Ready,
			CONNECTION_TIMEOUT,
		);
	}
	catch (error) {
		destroyConnection(connection);
		throw new Error(`Could not join the voice channel: ${error.message}`);
	}

	const player = createAudioPlayer();
	const resource = createAudioResource(audioFile);
	connection.subscribe(player);

	return new Promise((resolve, reject) => {
		player.once(AudioPlayerStatus.Idle, () => {
			destroyConnection(connection);
			resolve();
		});
		player.once('error', error => {
			destroyConnection(connection);
			reject(error);
		});
		player.play(resource);
	});
}

function destroyConnection(connection) {
	if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
		connection.destroy();
	}
}

module.exports = { playLocalAudio };

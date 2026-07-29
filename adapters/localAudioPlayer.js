const {
	AudioPlayerStatus,
	VoiceConnectionStatus,
	createAudioPlayer,
	createAudioResource,
	entersState,
	joinVoiceChannel,
} = require('@discordjs/voice');

const CONNECTION_TIMEOUT = 20_000;

function createLocalAudioManager(overrides = {}) {
	const dependencies = {
		createAudioPlayer,
		createAudioResource,
		entersState,
		joinVoiceChannel,
		...overrides,
	};
	const activeConnections = new Set();
	const activePlayers = new Set();

	async function play(voiceChannel, audioFile) {
		const connection = dependencies.joinVoiceChannel({
			channelId: voiceChannel.id,
			guildId: voiceChannel.guild.id,
			adapterCreator: voiceChannel.guild.voiceAdapterCreator,
		});
		activeConnections.add(connection);

		try {
			await dependencies.entersState(
				connection,
				VoiceConnectionStatus.Ready,
				CONNECTION_TIMEOUT,
			);
		}
		catch (error) {
			activeConnections.delete(connection);
			destroyConnection(connection);
			throw new Error(`Could not join the voice channel: ${error.message}`);
		}

		const player = dependencies.createAudioPlayer();
		const resource = dependencies.createAudioResource(audioFile);
		activePlayers.add(player);
		connection.subscribe(player);

		return new Promise((resolve, reject) => {
			player.once(AudioPlayerStatus.Idle, () => {
				const cleanupError = release(connection, player);
				if (cleanupError) {
					reject(cleanupError);
				}
				else {
					resolve();
				}
			});
			player.once('error', error => {
				release(connection, player);
				reject(error);
			});
			player.play(resource);
		});
	}

	function disconnectAll() {
		let firstError = null;
		for (const player of [...activePlayers]) {
			try {
				player.stop(true);
			}
			catch (error) {
				firstError ??= error;
			}
		}
		for (const connection of [...activeConnections]) {
			try {
				destroyConnection(connection);
			}
			catch (error) {
				firstError ??= error;
			}
		}
		activePlayers.clear();
		activeConnections.clear();
		if (firstError) {
			throw firstError;
		}
	}

	function getActiveResourceCounts() {
		return {
			connections: activeConnections.size,
			players: activePlayers.size,
		};
	}

	function release(connection, player) {
		activeConnections.delete(connection);
		activePlayers.delete(player);
		try {
			destroyConnection(connection);
			return null;
		}
		catch (error) {
			return error;
		}
	}

	return {
		disconnectAll,
		getActiveResourceCounts,
		play,
	};
}

function destroyConnection(connection) {
	if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
		connection.destroy();
	}
}

const localAudioManager = createLocalAudioManager();

function playLocalAudio(voiceChannel, audioFile) {
	return localAudioManager.play(voiceChannel, audioFile);
}

function disconnectVoiceResources() {
	return localAudioManager.disconnectAll();
}

module.exports = {
	createLocalAudioManager,
	disconnectVoiceResources,
	playLocalAudio,
};

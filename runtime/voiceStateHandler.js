const path = require('node:path');

function createVoiceStateHandler({
	audioPath,
	getConfig,
	logger = console,
	playLocalAudio,
}) {
	return async (oldState, newState) => {
		try {
			const config = getConfig();
			const userId = getVoiceStateUserId(oldState, newState);
			if (
				oldState?.channelId !== null
				|| newState?.channelId !== config.channels?.teamVoice
				|| !newState?.channel
				|| !userId
				|| userId === config.botUserId
			) {
				return;
			}
			await playLocalAudio(newState.channel, audioPath);
		}
		catch (error) {
			logger.error(`Could not play ${path.basename(audioPath)}:`, error);
		}
	};
}

function getVoiceStateUserId(oldState, newState) {
	return oldState?.id
		?? newState?.id
		?? oldState?.member?.id
		?? newState?.member?.id
		?? oldState?.member?.user?.id
		?? newState?.member?.user?.id;
}

module.exports = { createVoiceStateHandler, getVoiceStateUserId };

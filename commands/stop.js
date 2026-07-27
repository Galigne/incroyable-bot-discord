module.exports = {
	name: 'stop',
	description: 'Arrête les musiques en cours',
	async execute(message) {
		const serverQueue = message.client.queue.get(message.guild.id);
		if (!message.member.voice.channel) {
			await message.channel.send('Tu dois être dans un salon vocal pour arrêter la musique.');
			return;
		}
		if (!serverQueue) {
			await message.channel.send('Il n’y a aucune musique en cours.');
			return;
		}

		serverQueue.songs = [];
		if (!serverQueue.player.stop(true)) {
			serverQueue.connection.destroy();
			message.client.queue.delete(message.guild.id);
		}
	},
};

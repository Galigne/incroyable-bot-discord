module.exports = {
	name: 'stop',
	description: 'Stop all songs in the queue!',
	execute(message) {
		const serverQueue = message.client.queue.get(message.guild.id);
		if (!message.member.voice.channel) return message.channel.send('Tu dois etre dans un channel vocal pour arrêter la musique!');
		serverQueue.songs = [];
		serverQueue.connection.dispatcher.end();
	},
};
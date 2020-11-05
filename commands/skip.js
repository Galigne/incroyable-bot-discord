module.exports = {
	name: 'skip',
	description: 'Skip a song!',
	execute(message) {
		const serverQueue = message.client.queue.get(message.guild.id);
		if (!message.member.voice.channel) return message.channel.send('Tu dois etre dans un channel vocal pour arrêter la musique!');
		if (!serverQueue) return message.channel.send('Il n\'y a aucun son a passer!');
		serverQueue.connection.dispatcher.end();
	},
};
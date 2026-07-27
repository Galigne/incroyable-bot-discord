module.exports = {
	name: 'skip',
	description: 'Passe une musique',
	async execute(message) {
		const serverQueue = message.client.queue.get(message.guild.id);
		if (!message.member.voice.channel) {
			await message.channel.send('Tu dois être dans un salon vocal pour passer la musique.');
			return;
		}
		if (!serverQueue) {
			await message.channel.send('Il n’y a aucun son à passer.');
			return;
		}
		serverQueue.player.stop();
	},
};

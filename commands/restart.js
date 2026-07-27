module.exports = {
	name: 'restart',
	description: 'Redémarre le bot',
	async execute(message, client, token) {
		await message.channel.send('Redémarrage…');
		client.destroy();
		await client.login(token);
	},
};

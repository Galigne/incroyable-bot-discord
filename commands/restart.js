module.exports = {
	name: 'restart',
	description: 'Reconnect the bot to Discord',
	usage: '!restart',
	helpOrder: 70,
	access: {
		role: 'moderator',
	},
	async execute({ client, message, token }) {
		await message.channel.send('Reconnecting...');
		client.destroy();
		await client.login(token);
	},
};

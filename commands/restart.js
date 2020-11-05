module.exports = {
	name: 'restart',
	description: 'Restart the bot',
	execute(message, client, token) {
		message.channel.send('Restarting...').then(m => {
		  client.destroy().then(() => {
			client.login('token');
		  });
		});
	},
};
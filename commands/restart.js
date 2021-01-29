module.exports = {
	name: 'restart',
	description: 'Redémarre le bot',
	execute(message, client, token) {
		message.channel.send('Restarting...').then(m => {
		  client.destroy().then(() => {
			client.login('token');
		  });
		});
	},
};
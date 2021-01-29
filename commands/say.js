module.exports = {
	name: 'say',
	description: 'Fait écrire un message au bot',
	execute(message) {
        const content = message.content.substring(4);
        message.channel.send(content);
		message.delete();
	},
};
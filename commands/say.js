module.exports = {
	name: 'say',
	description: 'Send a message through the bot',
	usage: '!say <message>',
	helpOrder: 50,
	access: {
		role: 'moderator',
	},
	async execute({ args, message }) {
		const content = args.join(' ').trim();
		if (!content) {
			await message.reply('Provide a message to send.');
			return;
		}

		await message.channel.send(content);
		await message.delete();
	},
};

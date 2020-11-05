module.exports = {
	name: 'purge',
	description: 'Delete the last messages in all chats.',
	async execute(message) {
		const args = message.content.split(' ');
		let deleteCount = 0;
		try {
			deleteCount = parseInt(args[1], 10);
		}catch(err) {
			return message.reply('Donnez le nombre de message a supprimer. (max 100)')
		}
        

		if (!deleteCount || deleteCount < 2 || deleteCount > 100)
			return message.reply('Donnez le nombre de message a supprimer. (entre 2 et 100)');

		const fetched = await message.channel.messages.fetch({
			limit: deleteCount,
		});
		message.channel.bulkDelete(fetched)
			.catch(error => message.reply(`He n'ai pas pu supprimer les messages car: ${error}`));
	},
};
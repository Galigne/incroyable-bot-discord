const characterStore = require('../../../services/characterStore');

module.exports = {
	name: 'delete',
	description: 'Delete one of your characters',
	usage: '!rpg delete <characterKey>',
	helpOrder: 70,
	async execute({ args, message }) {
		const [name] = args;
		if (!name) {
			await message.reply('Usage: `!rpg delete <characterKey>`');
			return;
		}
		try {
			await characterStore.deleteCharacter(name, message.author.id);
			await message.reply(`Character **${name}** was deleted.`);
		}
		catch (error) {
			if (error.code === 'ENOENT') {
				await message.reply('That character does not exist.');
				return;
			}
			if (error.code === 'NOT_CHARACTER_OWNER') {
				await message.reply(error.message);
				return;
			}
			if (error.code === 'INVALID_CHARACTER_NAME') {
				await message.reply(error.message);
				return;
			}
			throw error;
		}
	},
};

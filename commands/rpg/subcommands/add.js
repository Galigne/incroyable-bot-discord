const characterStore = require('../../../services/characterStore');

module.exports = {
	name: 'add',
	description: 'Create a new character',
	usage: '!rpg add <name>',
	helpOrder: 20,
	async execute({ args, message }) {
		const [name] = args;
		if (!name) {
			await message.reply('Usage: `!rpg add <name>`');
			return;
		}
		try {
			await characterStore.createCharacter(name, message.author.id);
			await message.reply(`Character **${name}** was created.`);
		}
		catch (error) {
			if (error.code === 'EEXIST') {
				await message.reply('A character with that name already exists.');
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

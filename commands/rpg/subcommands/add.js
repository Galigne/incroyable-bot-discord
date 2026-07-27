const characterStore = require('../../../services/characterStore');

module.exports = {
	name: 'add',
	description: 'Create a blank character sheet with a stable CharacterKey',
	usage: '!rpg add <characterKey>',
	helpOrder: 20,
	async execute({ args, message }) {
		const [characterKey] = args;
		if (!characterKey) {
			await message.reply('Usage: `!rpg add <characterKey>`');
			return;
		}
		try {
			await characterStore.createCharacter(characterKey, message.author.id);
			await message.reply(
				`Character with key \`${characterKey}\` was created. `
				+ 'This CharacterKey cannot be edited. Use `!rpg editHelp` to set '
				+ 'its first name, last name, and other fields.',
			);
		}
		catch (error) {
			if (error.code === 'EEXIST') {
				await message.reply('A character with that key already exists.');
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

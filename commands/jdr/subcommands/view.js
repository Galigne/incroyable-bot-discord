const characterStore = require('../../../services/characterStore');

module.exports = {
	name: 'view',
	description: 'Display a character sheet',
	usage: '!jdr <name> or !jdr view <name>',
	helpOrder: 20,
	async execute({ args, message }) {
		const [name] = args;
		if (!name) {
			await message.reply('Usage: `!jdr <name>` or `!jdr view <name>`');
			return;
		}
		try {
			const character = await characterStore.getCharacter(name);
			await message.channel.send({ embeds: [character.toEmbed()] });
		}
		catch (error) {
			if (error.code === 'ENOENT') {
				await message.reply('That character does not exist.');
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

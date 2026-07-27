const RULES_URL = 'https://github.com/Galigne/incroyable-bot-discord/blob/master/documentation/TTRPG_RANDOM_RULES_EN.md';

module.exports = {
	name: 'rules',
	description: 'Open the public TTRPG rulebook',
	usage: '!rpg rules',
	helpOrder: 50,
	async execute({ message }) {
		await message.reply(`TTRPG rulebook: ${RULES_URL}`);
	},
};

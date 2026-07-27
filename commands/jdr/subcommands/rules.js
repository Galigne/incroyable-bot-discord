const RULES_URL = 'https://github.com/Galigne/incroyable-bot-discord/blob/master/documentation/JDR_RANDOM_RULES_EN.md';

module.exports = {
	name: 'rules',
	description: 'Open the public JDR rulebook',
	usage: '!jdr rules',
	helpOrder: 40,
	async execute({ message }) {
		await message.reply(`JDR rulebook: ${RULES_URL}`);
	},
};

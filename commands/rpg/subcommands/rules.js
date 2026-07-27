const RULES_URL = 'https://github.com/Galigne/incroyable-bot-discord/blob/master/documentation/TTRPG_RANDOM_RULES_EN.md';

module.exports = {
	name: 'rules',
	description: 'Open the public TTRPG rulebook',
	usage: '/rpg rules',
	helpOrder: 80,
	configure: command => command
		.setName('rules')
		.setDescription('Open the public TTRPG rulebook'),
	async execute({ interaction }) {
		await interaction.reply(`TTRPG rulebook: ${RULES_URL}`);
	},
};

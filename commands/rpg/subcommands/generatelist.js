const { EmbedBuilder } = require('discord.js');
const generatorCatalog = require('../../../services/generatorCatalog');

module.exports = {
	name: 'generatelist',
	description: 'List the available RPG generator categories (DM only)',
	usage: '!rpg generateList',
	helpOrder: 11,
	access: {
		role: 'dm',
	},
	async execute({ args, message }) {
		if (args.length > 0) {
			await message.reply('Usage: `!rpg generateList`');
			return;
		}

		const categories = generatorCatalog.listCategories();
		const embed = new EmbedBuilder()
			.setTitle('RPG Generator Categories')
			.setDescription('Use `!rpg generate <category>` to draw a random prompt.')
			.setColor('#FFD700')
			.addFields(categories.map(category => ({
				name: category.name,
				value: `${category.description} (${category.entries.length} prompts)`,
			})));
		await message.channel.send({ embeds: [embed] });
	},
};

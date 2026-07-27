const { EmbedBuilder } = require('discord.js');
const generatorCatalog = require('../../../services/generatorCatalog');

module.exports = {
	name: 'generate-list',
	description: 'List the available RPG generator categories (DM only)',
	usage: '/rpg generate-list',
	helpOrder: 11,
	access: {
		role: 'dm',
	},
	configure: command => command
		.setName('generate-list')
		.setDescription('List the available RPG generator categories'),
	async execute({ interaction }) {
		const categories = generatorCatalog.listCategories();
		const embed = new EmbedBuilder()
			.setTitle('RPG Generator Categories')
			.setDescription('Use `/rpg generate` to draw a random prompt.')
			.setColor('#FFD700')
			.addFields(categories.map(category => ({
				name: category.name,
				value: `${category.description} (${category.entries.length} prompts)`,
			})));
		await interaction.reply({ embeds: [embed] });
	},
};

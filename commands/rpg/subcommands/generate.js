const { EmbedBuilder } = require('discord.js');
const generatorCatalog = require('../../../services/generatorCatalog');

module.exports = {
	name: 'generate',
	description: 'Generate GM inspiration from a chosen category (DM only)',
	usage: '!rpg generate <category>',
	helpOrder: 10,
	access: {
		role: 'dm',
	},
	async execute({ args, message }) {
		const requestedCategory = args.join(' ').trim();
		if (!requestedCategory) {
			await message.reply('Usage: `!rpg generate <category>`');
			return;
		}

		const result = generatorCatalog.generate(requestedCategory);
		if (!result) {
			await message.reply(
				`Unknown generator category: **${requestedCategory}**. `
				+ 'Use `!rpg generateList` to see the available categories.',
			);
			return;
		}

		const embed = createGeneratedEmbed(result);
		await message.channel.send({ embeds: [embed] });
	},
};

function createGeneratedEmbed(result) {
	const embed = new EmbedBuilder()
		.setTitle(`Generated ${result.category.name}`)
		.setColor('#FFD700')
		.setFooter({ text: 'The GM may adapt or reroll any result.' });
	if (typeof result.entry === 'string' || result.entry.value !== undefined) {
		embed.setDescription(
			typeof result.entry === 'string' ? result.entry : result.entry.value,
		);
	}
	else {
		embed.addFields(
			Object.entries(result.entry.fields).map(([name, value]) => ({
				name,
				value: String(value),
			})),
		);
	}
	return embed;
}

module.exports.createGeneratedEmbed = createGeneratedEmbed;

const { EmbedBuilder, MessageFlags } = require('discord.js');
const generatorCatalog = require('../../../services/generatorCatalog');
const { filterAutocompleteChoices } = require('../../../util/autocomplete');

module.exports = {
	name: 'gen',
	description: 'Generate GM inspiration from a chosen category (DM only)',
	usage: '/rpg gen category:<category>',
	helpOrder: 10,
	access: {
		role: 'dm',
	},
	configure: command => command
		.setName('gen')
		.setDescription('Generate GM inspiration from a chosen category')
		.addStringOption(option => option
			.setName('category')
			.setDescription('Generator category')
			.setAutocomplete(true)
			.setRequired(true)),
	async autocomplete({ interaction }) {
		const categories = generatorCatalog.listCategories();
		await interaction.respond(filterAutocompleteChoices(
			categories.map(category => ({
				name: `${category.name} — ${category.description}`.slice(0, 100),
				value: category.name,
			})),
			interaction.options.getFocused(),
		));
	},
	async execute({ interaction }) {
		const requestedCategory = interaction.options.getString('category', true);
		const result = generatorCatalog.generate(requestedCategory);
		if (!result) {
			await interaction.reply({
				content: `Unknown generator category: **${requestedCategory}**. `
					+ 'Use `/rpg gen-help` to see the available categories.',
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const embed = createGeneratedEmbed(result);
		await interaction.reply({ embeds: [embed] });
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

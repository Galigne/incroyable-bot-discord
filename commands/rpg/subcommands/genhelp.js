const { EmbedBuilder } = require('discord.js');
const generatorCatalog = require('../../../services/generatorCatalog');

module.exports = {
	name: 'gen-help',
	description: 'Explain random generation and list generator categories (DM only)',
	usage: '/rpg gen-help',
	helpOrder: 12,
	access: {
		role: 'dm',
	},
	configure: command => command
		.setName('gen-help')
		.setDescription('Explain random generation and list generator categories'),
	async execute({ interaction }) {
		const categories = generatorCatalog.listCategories();
		const categoryLines = categories.map(category => (
			`**${category.name}** — ${category.description} `
			+ `(${category.entries.length} entries)`
		));
		const embed = new EmbedBuilder()
			.setTitle('RPG Generation Help')
			.setDescription([
				'`/rpg gen category:<category>`',
				'DM-only. Select a generator with autocomplete to draw one weighted random '
					+ 'entry. Run it again to reroll.',
				'',
				'`/rpg gen-char character-key:<new key> [level] [background]`',
				'DM-only. Creates and saves a complete random character using a unique '
					+ 'CharacterKey. Level must be 1–10; when omitted, it is rolled randomly. '
					+ 'Background selects the NPC category and is random when omitted. '
					+ 'Statistics, resources, equipment, inventory, and gold are generated '
					+ 'from the character level and game rules. Intelligence grants RULE Points; '
					+ 'they raise the first RULE as far as possible before creating a second, '
					+ 'with a maximum of two RULEs.',
			].join('\n'))
			.setColor('#FFD700')
			.addFields(chunkLines(categoryLines).map((value, index) => ({
				name: index === 0 ? 'Available generators' : 'Available generators (continued)',
				value,
			})));
		await interaction.reply({ embeds: [embed] });
	},
};

function chunkLines(lines, maxLength = 1_000) {
	const chunks = [];
	let chunk = '';
	for (const line of lines) {
		if (chunk && chunk.length + line.length + 1 > maxLength) {
			chunks.push(chunk);
			chunk = '';
		}
		chunk += `${chunk ? '\n' : ''}${line}`;
	}
	if (chunk) {
		chunks.push(chunk);
	}
	return chunks;
}

module.exports.chunkLines = chunkLines;

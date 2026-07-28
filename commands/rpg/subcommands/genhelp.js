const { EmbedBuilder } = require('discord.js');
const generatorCatalog = require('../../../services/generatorCatalog');
const { getLocale, localizeDescription, t } = require('../../../util/i18n');

const descriptionKey = 'rpg.genHelp.description';

module.exports = {
	name: 'gen-help',
	description: t('en', descriptionKey),
	descriptionKey,
	usage: '/rpg gen-help',
	helpOrder: 12,
	access: {
		role: 'dm',
	},
	configure: command => localizeDescription(
		command.setName('gen-help'),
		'rpg.genHelp.schemaDescription',
	),
	async execute({ config, interaction }) {
		const locale = getLocale(config, interaction.guildId);
		const categories = generatorCatalog.listGenerators(locale);
		const categoryLines = categories.map(category => t(
			locale,
			'rpg.genHelp.categoryLine',
			{
				count: category.entries.length,
				description: category.description,
				name: category.name,
			},
		));
		const embed = new EmbedBuilder()
			.setTitle(t(locale, 'rpg.genHelp.title'))
			.setDescription(t(locale, 'rpg.genHelp.body'))
			.setColor('#FFD700')
			.addFields(chunkLines(categoryLines).map((value, index) => ({
				name: index === 0
					? t(locale, 'rpg.genHelp.available')
					: t(locale, 'common.continued', {
						label: t(locale, 'rpg.genHelp.available'),
					}),
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

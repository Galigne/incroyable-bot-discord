const { EmbedBuilder, MessageFlags } = require('discord.js');
const { t } = require('./i18n');

const GENERATOR_FIELD_KEYS = {
	'AR percentage': 'arPercentage',
	Allies: 'allies',
	Appearance: 'appearance',
	Backstory: 'backstory',
	Commandment: 'commandment',
	'Constitution requirement': 'constitutionRequirement',
	'Deity or Belief': 'deityOrBelief',
	Description: 'description',
	Encumbrance: 'encumbrance',
	Enemies: 'enemies',
	FirstName: 'firstName',
	Generator: 'generator',
	Goal: 'goal',
	Goals: 'goals',
	Hierarchy: 'hierarchy',
	'Holy Place': 'holyPlace',
	LastName: 'lastName',
	Leadership: 'leadership',
	Name: 'name',
	'Physical Ability': 'physicalAbility',
	Rarity: 'rarity',
	'Relationship with Magic': 'relationshipWithMagic',
	'Religious Order': 'religiousOrder',
	Resources: 'resources',
	Rites: 'rites',
	'Sacred Symbol': 'sacredSymbol',
	'Skill Bonus': 'skillBonus',
	Strength: 'strength',
	Structure: 'structure',
	Taboo: 'taboo',
	Tension: 'tension',
	Type: 'type',
};

function createGeneratorResponse(result, requestedCategory, locale = 'en') {
	if (!result) {
		return {
			content: t(locale, 'rpg.gen.unknownCategory', {
				category: requestedCategory,
			}),
			flags: MessageFlags.Ephemeral,
		};
	}
	return { embeds: [createGeneratedEmbed(result, locale)] };
}

function createGeneratedEmbed(result, locale = 'en') {
	const embed = new EmbedBuilder()
		.setTitle(t(locale, 'rpg.gen.title', { category: result.category.name }))
		.setColor('#FFD700')
		.setFooter({ text: t(locale, 'rpg.gen.footer') });
	if (typeof result.entry === 'string' || result.entry.value !== undefined) {
		embed.setDescription(
			typeof result.entry === 'string' ? result.entry : result.entry.value,
		);
	}
	else {
		embed.addFields(
			Object.entries(result.entry.fields).map(([name, value]) => ({
				name: getGeneratorFieldLabel(name, locale),
				value: String(value),
			})),
		);
	}
	return embed;
}

function createGeneratorHelpResponse(categories, locale = 'en') {
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
	return { embeds: [embed] };
}

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

function getGeneratorFieldLabel(field, locale) {
	const key = GENERATOR_FIELD_KEYS[field];
	return key ? t(locale, `generatorFields.${key}`) : field;
}

module.exports = {
	chunkLines,
	createGeneratedEmbed,
	createGeneratorHelpResponse,
	createGeneratorResponse,
};

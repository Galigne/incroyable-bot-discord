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

function getGeneratorFieldLabel(field, locale) {
	const key = GENERATOR_FIELD_KEYS[field];
	return key ? t(locale, `generatorFields.${key}`) : field;
}

module.exports = {
	createGeneratedEmbed,
	createGeneratorResponse,
};

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
		.setTitle(t(locale, 'rpg.gen.title', { category: result.generatorName }))
		.setColor('#FFD700');
	if (result.outputType === 'fields') {
		embed.addFields(
			Object.entries(result.fields).map(([name, value]) => ({
				name: getGeneratorFieldLabel(name, locale),
				value: String(value),
			})),
		);
	}
	else {
		embed.setDescription(
			result.outputType === 'template' ? result.templateOutput : result.value,
		);
	}
	addModifiers(embed, result, locale);
	return embed;
}

function addModifiers(embed, result, locale) {
	if (!result.modifiers?.length) {
		return;
	}
	const title = t(locale, 'rpg.gen.modifiers');
	const value = truncate(result.modifiers.map(modifier => (
		`**${modifier.name}** — ${modifier.description}`
	)).join('\n'), 1_024);
	const fieldCount = result.outputType === 'fields'
		? Object.keys(result.fields).length
		: 0;
	if (fieldCount < 25) {
		embed.addFields({ name: title, value });
		return;
	}
	embed.setDescription(`**${title}**\n${value}`);
}

function truncate(value, maximumLength) {
	return value.length <= maximumLength
		? value
		: `${value.slice(0, maximumLength - 1).trimEnd()}…`;
}

function getGeneratorFieldLabel(field, locale) {
	const key = GENERATOR_FIELD_KEYS[field];
	return key ? t(locale, `generatorFields.${key}`) : field;
}

module.exports = {
	createGeneratedEmbed,
	createGeneratorResponse,
};

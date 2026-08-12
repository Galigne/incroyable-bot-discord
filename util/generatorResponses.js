const { EmbedBuilder, MessageFlags } = require('discord.js');
const { t } = require('./i18n');

const GENERATOR_FIELD_KEYS = {
	ar_percentage: 'arPercentage',
	allies: 'allies',
	appearance: 'appearance',
	backstory: 'backstory',
	commandment: 'commandment',
	constitution_requirement: 'constitutionRequirement',
	deity_or_belief: 'deityOrBelief',
	description: 'description',
	enemies: 'enemies',
	first_name: 'firstName',
	generator: 'generator',
	goal: 'goal',
	goals: 'goals',
	hierarchy: 'hierarchy',
	holy_place: 'holyPlace',
	last_name: 'lastName',
	leadership: 'leadership',
	name: 'name',
	physical_ability: 'physicalAbility',
	rarity: 'rarity',
	relationship_with_magic: 'relationshipWithMagic',
	religious_order: 'religiousOrder',
	resources: 'resources',
	rites: 'rites',
	sacred_symbol: 'sacredSymbol',
	skill_bonus: 'skillBonus',
	strength: 'strength',
	structure: 'structure',
	taboo: 'taboo',
	tension: 'tension',
	type: 'type',
};

function createGeneratorResponse(
	result,
	requestedCategory,
	locale = 'en',
	requestedModifier,
) {
	if (!result) {
		return {
			content: t(
				locale,
				requestedModifier
					? 'rpg.gen.invalidModifier'
					: 'rpg.gen.unknownCategory',
				{
					category: requestedCategory,
					modifier: requestedModifier,
				},
			),
			flags: MessageFlags.Ephemeral,
		};
	}
	return {
		embeds: flattenGeneratedResults(result).map((generated, index) => (
			createGeneratedEmbed(generated, locale, { isModifier: index > 0 })
		)),
	};
}

function createGeneratedEmbed(result, locale = 'en', options = {}) {
	const embed = new EmbedBuilder()
		.setTitle(t(
			locale,
			options.isModifier ? 'rpg.gen.modifierTitle' : 'rpg.gen.title',
			{ category: result.generatorName },
		))
		.setColor('#FFD700');
	if (result.outputType === 'fields') {
		embed.addFields(
			Object.entries(result.displayFields).map(([name, value]) => ({
				name: getGeneratorFieldLabel(name, locale),
				value: String(value),
			})),
		);
	}
	else {
		embed.setDescription(
			result.value,
		);
	}
	return embed;
}

function flattenGeneratedResults(result) {
	return [
		result,
		...(result.modifiers ?? []).flatMap(flattenGeneratedResults),
	];
}

function getGeneratorFieldLabel(field, locale) {
	const key = GENERATOR_FIELD_KEYS[field];
	return key ? t(locale, `generatorFields.${key}`) : field;
}

module.exports = {
	createGeneratedEmbed,
	createGeneratorResponse,
};

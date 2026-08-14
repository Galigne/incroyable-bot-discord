const { EmbedBuilder, MessageFlags } = require('discord.js');
const { t } = require('./i18n');

const GENERATOR_FIELD_KEYS = {
	ar_percentage: 'arPercentage',
	allies: 'allies',
	commandment: 'commandment',
	constitution_requirement: 'constitutionRequirement',
	deity_or_belief: 'deityOrBelief',
	description: 'description',
	enemies: 'enemies',
	first_name: 'firstName',
	goal: 'goal',
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
) {
	if (!result) {
		return {
			content: t(locale, 'rpg.gen.unknownCategory', {
				category: requestedCategory,
			}),
			flags: MessageFlags.Ephemeral,
		};
	}
	return {
		embeds: flattenGeneratedResults(result).map((generated, index) => (
			createGeneratedEmbed(generated, locale, { isModifier: index > 0 })
		)),
	};
}

function createGeneratorBatchResponse(
	results,
	requestedCategory,
	locale = 'en',
) {
	const firstResult = results.find(Boolean);
	if (!firstResult || results.some(result => !result)) {
		return createGeneratorResponse(
			null,
			requestedCategory,
			locale,
		);
	}
	return {
		embeds: results.map((result, index) => (
			createGeneratorBatchEmbed(result, locale, index + 1, results.length)
		)),
	};
}

function createGeneratorResultsResponse(
	results,
	requestedCategory,
	locale = 'en',
) {
	if (results.length === 1) {
		return createGeneratorResponse(
			results[0],
			requestedCategory,
			locale,
		);
	}
	return createGeneratorBatchResponse(
		results,
		requestedCategory,
		locale,
	);
}

function createGeneratorBatchEmbed(result, locale, index, count) {
	const embed = new EmbedBuilder()
		.setTitle(t(locale, 'rpg.gen.batchResultTitle', {
			category: result.generatorName,
			count,
			index,
		}))
		.setColor('#FFD700');
	if (result.outputType === 'fields') {
		embed.addFields(
			Object.entries(result.displayFields).map(([name, value]) => ({
				name: getGeneratorFieldLabel(name, locale),
				value: renderGeneratorValue(
					value,
					result.displayFieldTemplates?.[name],
				),
			})),
		);
	}
	else {
		embed.setDescription(renderGeneratorValue(result.value, result.valueTemplate));
	}
	for (const modifier of result.modifiers ?? []) {
		addBatchModifier(embed, modifier, locale);
	}
	return embed;
}

function addBatchModifier(embed, modifier, locale) {
	const value = modifier.outputType === 'fields'
		? Object.entries(modifier.displayFields ?? {})
			.map(([name, fieldValue]) => (
				`**${getGeneratorFieldLabel(name, locale)}:** ${renderGeneratorValue(
					fieldValue,
					modifier.displayFieldTemplates?.[name],
				)}`
			))
			.join('\n')
		: renderGeneratorValue(modifier.value, modifier.valueTemplate);
	embed.addFields({
		name: t(locale, 'rpg.gen.modifierTitle', {
			category: modifier.generatorName,
		}),
		value,
	});
	for (const nestedModifier of modifier.modifiers ?? []) {
		addBatchModifier(embed, nestedModifier, locale);
	}
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
				value: renderGeneratorValue(
					value,
					result.displayFieldTemplates?.[name],
				),
			})),
		);
	}
	else {
		embed.setDescription(renderGeneratorValue(result.value, result.valueTemplate));
	}
	return embed;
}

function renderGeneratorValue(value, template) {
	if (!template || !Array.isArray(template.parts)) {
		return String(value);
	}
	return renderGeneratorTemplate(template, false);
}

function renderGeneratorTemplate(template, nested) {
	return template.parts.map(part => {
		if (part.type === 'text') {
			return part.value;
		}
		if (part.type !== 'reference') {
			return '';
		}
		const rendered = renderGeneratorTemplate(part.template, true);
		return nested ? `[${rendered}]` : `\`${rendered}\``;
	}).join('');
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
	createGeneratorBatchResponse,
	createGeneratedEmbed,
	createGeneratorResponse,
	createGeneratorResultsResponse,
};

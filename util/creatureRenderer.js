const { EmbedBuilder } = require('discord.js');
const generatorCatalog = require('../services/generatorCatalog');
const {
	getCreatureFieldDefinition,
	getViewableCreatureFieldDefinition,
} = require('../services/creatureFieldCatalog');
const { getEntityFieldLabel } = require('./entityDisplay');
const {
	formatCombatantGearFields,
	formatCombatantResourceFields,
	formatCombatantRuleDetails,
	formatCombatantStatisticsFields,
	formatCombatantStatusFields,
	formatCombatantSummaryRules,
	formatCombatantSummaryStatistics,
	formatCombatantSummaryStatus,
} = require('./combatantRendererPrimitives');
const {
	formatJoinedList,
	formatNumberedJoinedList,
	getStoredValue,
	truncate,
} = require('./entityRendererPrimitives');
const { t } = require('./i18n');

function createCreatureSummaryEmbed(creature, locale = 'en') {
	const getLabel = fieldId => label(locale, fieldId);
	const status = formatCombatantSummaryStatus(creature, getLabel, locale);
	const stats = formatCombatantSummaryStatistics(creature, getLabel);
	const rightSections = [];
	if (creature.rules.length > 0) {
		rightSections.push({
			label: getLabel('rules'),
			value: formatCombatantSummaryRules(
				creature.rules,
				rule => t(locale, 'creature.summary.ruleLevel', {
					level: rule.level,
					name: rule.name,
				}),
				formatNumberedJoinedList,
				250,
				locale,
			),
		});
	}
	if (creature.traits.length > 0) {
		rightSections.push({
			label: getLabel('traits'),
			value: formatStringList(creature.traits, 250, locale),
		});
	}
	const rightColumn = rightSections
		.map((section, index) => `${index === 0 ? '' : `**${section.label}**\n`}${section.value}`)
		.join('\n\n');
	const archetype = getArchetype(creature, locale);
	const description = [
		archetype
			? t(locale, 'creature.summary.identity', {
				archetype,
				level: creature.level,
			})
			: `${label(locale, 'level')} **${creature.level}**`,
		...(hasText(creature.description) ? [creature.description] : []),
	].join('\n');
	const summaryFields = [
		{
			name: getLabel('status'),
			value: truncate(status),
		},
		{
			name: getLabel('statistics'),
			value: truncate(stats),
			inline: true,
		},
	];
	if (rightSections.length > 0) {
		summaryFields.push({
			name: rightSections[0].label,
			value: truncate(rightColumn),
			inline: true,
		});
	}
	return new EmbedBuilder()
		.setTitle(creature.displayName)
		.setDescription(description)
		.setColor('#8B5CF6')
		.addFields(summaryFields);
}

function createCreatureFieldEmbed(creature, fieldName, locale = 'en') {
	const definition = getViewableCreatureFieldDefinition(fieldName);
	if (!definition) {
		return null;
	}
	const field = definition.sectionId;
	const targets = definition.viewTargetIds.map(getCreatureFieldDefinition);
	const getLabel = fieldId => label(locale, fieldId);
	const embed = new EmbedBuilder()
		.setTitle(t(locale, 'creature.detail.title', {
			field: getLabel(field),
			name: creature.displayName,
		}).slice(0, 256))
		.setColor('#8B5CF6');

	switch (field) {
	case 'identity':
		return embed.addFields(
			...targets.map(target => ({
				name: getLabel(target.id),
				value: truncate(
					getStoredValue(creature, target) || t(locale, 'common.empty'),
				),
			})),
			{
				name: t(locale, 'creature.fields.archetype'),
				value: formatArchetype(creature, locale),
			},
		);
	case 'level':
		return embed.setDescription(String(creature.level));
	case 'resources':
		return embed.addFields(...formatCombatantResourceFields(
			creature,
			targets,
			getLabel,
			locale,
		));
	case 'status':
		return embed.addFields(...formatCombatantStatusFields(
			creature,
			targets,
			getLabel,
			locale,
		));
	case 'statistics':
		return embed.addFields(...formatCombatantStatisticsFields(
			creature,
			targets,
			getLabel,
		));
	case 'rules':
		return embed.setDescription(formatCombatantRuleDetails(
			creature.rules,
			rule => `**${rule.name} (${rule.level})** - ${rule.description}`,
			blocks => formatJoinedList(blocks, 4_096, locale),
		));
	case 'traits':
		return embed.setDescription(formatStringList(creature.traits, 4_096, locale));
	case 'gear':
		return embed.addFields(...formatCombatantGearFields(
			creature,
			targets,
			getLabel,
			getCreatureFieldDefinition,
			{ locale, formatList: formatStringList, inlineEncumbrance: false },
		));
	default:
		return null;
	}
}

function formatArchetype(creature, locale) {
	return getArchetype(creature, locale) || t(locale, 'common.empty');
}

function getArchetype(creature, locale) {
	const archetypeId = creature.source?.archetypeId;
	const name = generatorCatalog.getGenerator('creature', locale)?.entries
		.find(entry => entry.id === archetypeId)?.fields?.name ?? archetypeId;
	return name ? name[0].toLocaleUpperCase(locale) + name.slice(1) : null;
}

function formatStringList(items, maxLength, locale) {
	return formatNumberedJoinedList(items, maxLength, locale);
}

function label(locale, fieldId) {
	return getEntityFieldLabel(locale, 'creature', fieldId);
}

function hasText(value) {
	return typeof value === 'string' && value.trim().length > 0;
}

module.exports = {
	createCreatureFieldEmbed,
	createCreatureSummaryEmbed,
};

const { EmbedBuilder } = require('discord.js');
const { BASE_STATS } = require('../services/mechanics/constants');
const generatorCatalog = require('../services/generatorCatalog');
const {
	getCreatureFieldDefinition,
	getViewableCreatureFieldDefinition,
} = require('../services/creatureFieldCatalog');
const {
	formatCombatantResource,
	formatCombatantResources,
} = require('./combatantDisplay');
const { formatDescribedRecords } = require('./describedRecordDisplay');
const { getEntityFieldLabel } = require('./entityDisplay');
const {
	formatJoinedList,
	formatNumberedJoinedList,
	formatRuleList,
	formatStatistics,
	getStoredValue,
	truncate,
} = require('./entityRendererPrimitives');
const { t } = require('./i18n');

function createCreatureSummaryEmbed(creature, locale = 'en') {
	const stats = BASE_STATS.map(stat => (
		`${label(locale, `statistics.${stat}`)}: **${creature.statistics[stat]}**`
	)).join('\n');
	const statusSections = [
		formatCombatantResources(creature, ['hp', 'ar', 'ap', 'md'], locale),
	];
	if (creature.status.effects.length > 0) {
		statusSections.push(
			`**${label(locale, 'status.effects')}**\n`
				+ formatDescribedRecords(creature.status.effects, 1_024, locale),
		);
	}
	if (creature.modifiers.length > 0) {
		statusSections.push(
			`**${label(locale, 'modifiers')}**\n`
				+ formatDescribedRecords(creature.modifiers, 1_024, locale),
		);
	}
	const rightSections = [];
	if (creature.rules.length > 0) {
		rightSections.push({
			label: label(locale, 'rules'),
			value: formatSummaryRules(creature.rules, locale),
		});
	}
	if (creature.traits.length > 0) {
		rightSections.push({
			label: label(locale, 'traits'),
			value: formatDescribedRecords(creature.traits, 250, locale),
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
			name: label(locale, 'status'),
			value: truncate(statusSections.join('\n\n')),
		},
		{
			name: label(locale, 'statistics'),
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
	const embed = new EmbedBuilder()
		.setTitle(t(locale, 'creature.detail.title', {
			field: label(locale, field),
			name: creature.displayName,
		}).slice(0, 256))
		.setColor('#8B5CF6');

	switch (field) {
	case 'identity':
		return embed.addFields(
			...targets.map(target => ({
				name: label(locale, target.id),
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
	case 'status':
		return embed.addFields(
			...targets.filter(target => target.resourceId).map(target => ({
				name: label(locale, target.id),
				value: formatCombatantResource(creature, target.resourceId, locale),
			})),
			{
				name: label(locale, 'status.effects'),
				value: formatDescribedRecords(
					creature.status.effects,
					1_024,
					locale,
				),
			},
			{
				name: t(locale, 'creature.fields.naturalArmor'),
				value: `${creature.naturalArmor.percentage}%`,
			},
		);
	case 'statistics':
		return embed.addFields(
			{
				name: label(locale, 'statistics.base'),
				value: formatStats(creature, targets.slice(0, BASE_STATS.length), locale),
				inline: true,
			},
			{
				name: label(locale, 'statistics.derived'),
				value: formatStats(creature, targets.slice(BASE_STATS.length), locale),
				inline: true,
			},
		);
	case 'rules':
		return embed.setDescription(formatRules(creature.rules, 4_096, locale));
	case 'traits':
		return embed.setDescription(formatDescribedRecords(
			creature.traits,
			4_096,
			locale,
		));
	case 'modifiers':
		return embed.setDescription(formatDescribedRecords(
			creature.modifiers,
			4_096,
			locale,
		));
	case 'gear':
		return embed.addFields(
			{
				name: label(locale, 'gear.equipment'),
				value: formatStringList(creature.gear.equipment, 1_024, locale),
			},
			{
				name: label(locale, 'gear.inventory'),
				value: formatStringList(creature.gear.inventory, 1_024, locale),
			},
			{
				name: label(locale, 'gear.encumbrance'),
				value: `**${creature.gear.encumbrance.current} / `
					+ `${creature.gear.encumbrance.max}**`,
			},
		);
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

function formatStats(creature, targets, locale) {
	return formatStatistics(
		creature,
		targets,
		target => label(locale, target.id),
	);
}

function formatRules(rules, maxLength, locale) {
	return formatRuleList(
		rules,
		rule => `**${rule.name} (${rule.level})** - ${rule.description}`,
		blocks => formatJoinedList(blocks, maxLength, locale),
	);
}

function formatSummaryRules(rules, locale) {
	return formatNumberedJoinedList(
		rules.map(rule => t(locale, 'creature.summary.ruleLevel', {
			level: rule.level,
			name: rule.name,
		})),
		250,
		locale,
	);
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

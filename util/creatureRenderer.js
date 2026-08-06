const { EmbedBuilder } = require('discord.js');
const { BASE_STATS } = require('../services/mechanics/constants');
const {
	getCreatureFieldDefinition,
	getViewableCreatureFieldDefinition,
} = require('../services/creatureFieldCatalog');
const {
	formatCharacterResource,
	formatCharacterResources,
} = require('./characterRenderer');
const { formatDescribedRecords } = require('./describedRecordDisplay');
const { getEntityFieldLabel } = require('./entityDisplay');
const { t } = require('./i18n');

function createCreatureSummaryEmbed(creature, locale = 'en') {
	const stats = BASE_STATS.map(stat => (
		`${label(locale, `statistics.${stat}`)}: **${creature.statistics[stat]}**`
	)).join('\n');
	return new EmbedBuilder()
		.setTitle(creature.displayName)
		.setDescription([
			t(locale, 'creature.summary.level', { level: creature.level }),
			formatArchetype(creature, locale),
			creature.description || t(locale, 'common.empty'),
		].join('\n'))
		.setColor('#8B5CF6')
		.addFields(
			{
				name: label(locale, 'status'),
				value: formatCreatureStatus(creature, locale),
			},
			{ name: label(locale, 'statistics'), value: stats, inline: true },
			{
				name: label(locale, 'traits'),
				value: formatDescribedRecords(creature.traits, 1_024, locale),
				inline: true,
			},
			{
				name: label(locale, 'rules'),
				value: formatRules(creature.rules, 1_024, locale),
			},
			{
				name: label(locale, 'modifiers'),
				value: formatDescribedRecords(creature.modifiers, 1_024, locale),
			},
			{
				name: label(locale, 'gear'),
				value: formatGear(creature, locale),
			},
		);
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
				value: formatCharacterResource(creature, target.resourceId, locale),
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

function formatCreatureStatus(creature, locale) {
	return [
		formatCharacterResources(creature, ['hp', 'ar', 'ap', 'md'], locale),
		`${label(locale, 'status.effects')}: `
			+ formatDescribedRecords(creature.status.effects, 500, locale),
	].join('\n');
}

function formatArchetype(creature, locale) {
	const archetypeId = creature.source?.archetypeId;
	return archetypeId
		? t(locale, `rpg.genMonster.${archetypeId}Choice`)
		: t(locale, 'common.empty');
}

function formatStats(creature, targets, locale) {
	return targets.map(target => (
		`${label(locale, target.id)}: **${getStoredValue(creature, target)}**`
	)).join('\n');
}

function formatRules(rules, maxLength, locale) {
	return truncateList(rules.map(rule => (
		`**${rule.name} (${rule.level})** - ${rule.description}`
	)), maxLength, locale);
}

function formatGear(creature, locale) {
	return [
		`**${label(locale, 'gear.equipment')}**: `
			+ formatStringList(creature.gear.equipment, 300, locale),
		`**${label(locale, 'gear.inventory')}**: `
			+ formatStringList(creature.gear.inventory, 300, locale),
		`**${label(locale, 'gear.encumbrance')}**: `
			+ `${creature.gear.encumbrance.current} / ${creature.gear.encumbrance.max}`,
	].join('\n');
}

function formatStringList(items, maxLength, locale) {
	return truncateList(items.map((item, index) => `${index + 1}. ${item}`), maxLength, locale);
}

function truncateList(items, maxLength, locale) {
	if (items.length === 0) {
		return t(locale, 'common.empty');
	}
	const result = items.join('\n');
	return result.length <= maxLength
		? result
		: `${result.slice(0, maxLength - 3)}...`;
}

function truncate(value, maxLength = 1_024) {
	return value.length <= maxLength
		? value
		: `${value.slice(0, maxLength - 1)}…`;
}

function getStoredValue(entity, definition) {
	return definition.path.reduce((value, key) => value[key], entity);
}

function label(locale, fieldId) {
	return getEntityFieldLabel(locale, 'creature', fieldId);
}

module.exports = {
	createCreatureFieldEmbed,
	createCreatureSummaryEmbed,
};

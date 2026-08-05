const { EmbedBuilder } = require('discord.js');
const {
	BASE_STATS,
	DERIVED_STATS,
} = require('../services/mechanics/constants');
const { clampActionPoints } = require('../services/mechanics/resources');
const { getViewableFieldDefinition } = require('../services/characterFieldCatalog');
const {
	getCharacterFieldLabel,
	getResourceAbbreviation,
} = require('./characterDisplay');
const { t } = require('./i18n');

const PROGRESS_RESOURCE_ICONS = {
	hp: ['❤️', '🖤'],
	ar: ['🟦', '⬛'],
	md: ['🟧', '⬛'],
};

function createCharacterSummaryEmbed(character, locale = 'en') {
	const status = [
		formatCharacterResources(character, ['hp', 'ar', 'ap', 'md'], locale),
		'',
		`**${getCharacterFieldLabel(locale, 'statusEffects')}**\n`
			+ formatList(character.statusEffects, 1_024, locale),
	].join('\n');
	const stats = BASE_STATS
		.map(stat => `${formatLabel(stat, locale)}: **${character.stats[stat]}**`)
		.join('\n');
	const racialTraits = [
		`${getCharacterFieldLabel(locale, 'racialTraits.skillBonus')}: `
			+ `${character.racialTraits.skillBonus || t(locale, 'common.empty')}`,
		`${getCharacterFieldLabel(locale, 'racialTraits.physicalAbility')}: `
			+ `${character.racialTraits.physicalAbility || t(locale, 'common.empty')}`,
	].join('\n');
	const [leftColumn, rightColumn] = createSummaryColumns(
		[
			stats,
			truncate(racialTraits, 250),
			formatList(character.equipment, 250, locale),
		],
		[
			formatList(
				character.rules.map(rule => t(locale, 'character.summary.ruleLevel', {
					level: rule.level,
					name: rule.name,
				})),
				250,
				locale,
			),
			formatList(character.talents, 250, locale),
			formatList(character.inventory, 250, locale),
		],
		[
			[
				getCharacterFieldLabel(locale, 'racialTraits'),
				getCharacterFieldLabel(locale, 'talents'),
			],
			[
				getCharacterFieldLabel(locale, 'equipment'),
				getCharacterFieldLabel(locale, 'inventory'),
			],
		],
	);

	return new EmbedBuilder()
		.setTitle(character.displayName)
		.setDescription([
			t(locale, 'character.summary.identity', {
				level: character.level,
				race: character.race.name || t(locale, 'character.summary.unspecifiedRace'),
			}),
			character.appearance || t(locale, 'character.summary.unspecifiedAppearance'),
		].join('\n'))
		.setColor('#FFD700')
		.addFields(
			{ name: getCharacterFieldLabel(locale, 'status'), value: truncate(status) },
			{
				name: getCharacterFieldLabel(locale, 'statistics'),
				value: leftColumn,
				inline: true,
			},
			{
				name: getCharacterFieldLabel(locale, 'rules'),
				value: rightColumn,
				inline: true,
			},
		);
}

function createCharacterFieldEmbed(character, fieldName, locale = 'en') {
	const field = normalizeFieldName(fieldName);
	const embed = new EmbedBuilder()
		.setTitle(t(locale, 'character.detail.title', {
			field: getFieldTitle(field, locale),
			name: character.displayName,
		}))
		.setColor('#FFD700');

	switch (field) {
	case 'name':
		return embed.addFields(
			{
				name: getCharacterFieldLabel(locale, 'firstName'),
				value: character.firstName || t(locale, 'common.empty'),
				inline: true,
			},
			{
				name: getCharacterFieldLabel(locale, 'lastName'),
				value: character.lastName || t(locale, 'common.empty'),
				inline: true,
			},
		);
	case 'firstname':
		return embed.setDescription(character.firstName || t(locale, 'common.empty'));
	case 'lastname':
		return embed.setDescription(character.lastName || t(locale, 'common.empty'));
	case 'level':
		return embed.setDescription(String(character.level));
	case 'race':
		return embed.addFields(
			{
				name: getCharacterFieldLabel(locale, 'race.name'),
				value: truncate(character.race.name || t(locale, 'common.empty')),
			},
			{
				name: getCharacterFieldLabel(locale, 'race.physicalDescription'),
				value: truncate(
					character.race.physicalDescription || t(locale, 'common.empty'),
				),
			},
			{
				name: getCharacterFieldLabel(locale, 'race.lore'),
				value: truncate(character.race.lore || t(locale, 'common.empty')),
			},
		);
	case 'appearance':
		return embed.setDescription(truncate(
			character.appearance || t(locale, 'common.empty'),
			4_096,
		));
	case 'backstory':
		return embed.setDescription(truncate(
			character.backstory || t(locale, 'common.empty'),
			4_096,
		));
	case 'goals':
		return embed.setDescription(truncate(
			character.goals || t(locale, 'common.empty'),
			4_096,
		));
	case 'personality':
		return embed.addFields(
			{
				name: getCharacterFieldLabel(locale, 'personality.traits'),
				value: formatList(character.personality.traits, 1_024, locale),
			},
			{
				name: getCharacterFieldLabel(locale, 'personality.description'),
				value: truncate(
					character.personality.description || t(locale, 'common.empty'),
				),
			},
		);
	case 'racialtraits':
		return embed.addFields(
			{
				name: getCharacterFieldLabel(locale, 'racialTraits.skillBonus'),
				value: truncate(
					character.racialTraits.skillBonus || t(locale, 'common.empty'),
				),
			},
			{
				name: getCharacterFieldLabel(locale, 'racialTraits.physicalAbility'),
				value: truncate(
					character.racialTraits.physicalAbility || t(locale, 'common.empty'),
				),
			},
		);
	case 'statistics':
		return embed.addFields(
			{
				name: getCharacterFieldLabel(locale, 'statistics.base'),
				value: formatStats(character.stats, BASE_STATS, locale),
				inline: true,
			},
			{
				name: getCharacterFieldLabel(locale, 'statistics.derived'),
				value: formatStats(character.stats, DERIVED_STATS, locale),
				inline: true,
			},
		);
	case 'rules':
		return embed.setDescription(formatRules(character.rules, locale));
	case 'talents':
		return embed.setDescription(formatList(character.talents, 4_096, locale));
	case 'status':
		return embed.setDescription(formatDetailedStatus(character, locale));
	case 'statuseffects':
		return embed.setDescription(formatList(character.statusEffects, 1_024, locale));
	case 'equipment':
		return embed.setDescription(formatList(character.equipment, 1_024, locale));
	case 'inventory':
		return embed.setDescription(formatList(character.inventory, 1_024, locale));
	case 'encumbrance':
		return embed.setDescription(formatResource(
			getCharacterFieldLabel(locale, 'encumbrance'),
			character.encumbrance,
		));
	default:
		if (['hp', 'ar', 'ap', 'md'].includes(field)) {
			return embed.setDescription(formatCharacterResource(character, field, locale));
		}
		return null;
	}
}

function formatResource(label, resource) {
	return `${label}: **${resource.current} / ${resource.max}**`;
}

function formatProgressResource(label, resource, filledIcon, emptyIcon) {
	const percentage = getResourcePercentage(resource);
	const filledCount = Math.round(percentage / 10);
	const bar = filledIcon.repeat(filledCount) + emptyIcon.repeat(10 - filledCount);
	return `${label}: **${resource.current} / ${resource.max} (${percentage}%)**\n${bar}`;
}

function formatAp(resource, locale = 'en') {
	const maxAp = clampActionPoints(resource.max);
	const availableAp = Math.min(clampActionPoints(resource.current), maxAp);
	const spentAp = maxAp - availableAp;
	return `${getResourceAbbreviation(locale, 'ap')}:\n`
		+ `${'🌟'.repeat(availableAp)}`
		+ `${'⭐'.repeat(spentAp) || (maxAp === 0 ? t(locale, 'common.empty') : '')}`;
}

function formatCharacterResource(character, resourceId, locale = 'en') {
	if (resourceId === 'ap') {
		return formatAp(character.resources.ap, locale);
	}
	const icons = PROGRESS_RESOURCE_ICONS[resourceId];
	if (!icons) {
		throw new RangeError(`Unsupported visual resource: ${resourceId}`);
	}
	return formatProgressResource(
		getResourceAbbreviation(locale, resourceId),
		character.resources[resourceId],
		icons[0],
		icons[1],
	);
}

function formatCharacterResources(character, resourceIds, locale = 'en') {
	return resourceIds
		.map(resourceId => formatCharacterResource(character, resourceId, locale))
		.join('\n');
}

function formatDetailedStatus(character, locale = 'en') {
	return truncate([
		formatCharacterResources(character, ['hp', 'ar', 'ap', 'md'], locale),
		formatResource(getCharacterFieldLabel(locale, 'encumbrance'), character.encumbrance),
		'',
		`**${getCharacterFieldLabel(locale, 'statusEffects')}**\n`
			+ formatList(character.statusEffects, 1_024, locale),
	].join('\n'), 4_096);
}

function getResourcePercentage(resource) {
	if (resource.max <= 0) {
		return 0;
	}
	return Math.max(0, Math.min(100, Math.round(resource.current / resource.max * 100)));
}

function formatStats(stats, statNames, locale = 'en') {
	return statNames
		.map(stat => `${formatLabel(stat, locale)}: **${stats[stat]}**`)
		.join('\n');
}

function createSummaryColumns(leftSections, rightSections, nextHeadings) {
	let leftColumn = leftSections[0];
	let rightColumn = rightSections[0];

	for (let index = 0; index < nextHeadings.length; index += 1) {
		const leftLineCount = countLines(leftSections[index]);
		const rightLineCount = countLines(rightSections[index]);
		const sectionHeight = Math.max(leftLineCount, rightLineCount);
		const [leftHeading, rightHeading] = nextHeadings[index];

		leftColumn += '\n'.repeat(sectionHeight - leftLineCount + 2)
			+ `**${leftHeading}**\n${leftSections[index + 1]}`;
		rightColumn += '\n'.repeat(sectionHeight - rightLineCount + 2)
			+ `**${rightHeading}**\n${rightSections[index + 1]}`;
	}

	return [truncate(leftColumn), truncate(rightColumn)];
}

function countLines(value) {
	return value.split('\n').length;
}

function formatRules(rules, locale = 'en') {
	if (rules.length === 0) {
		return t(locale, 'common.empty');
	}
	const value = rules.map((rule, index) => t(locale, 'character.detail.rule', {
		description: rule.description || t(locale, 'character.detail.noDescription'),
		index: index + 1,
		level: rule.level,
		name: rule.name,
	})).join('\n\n');
	return truncate(value, 4_096);
}

function normalizeFieldName(value = '') {
	const definition = getViewableFieldDefinition(value);
	return definition
		? definition.viewId.toLowerCase()
		: value.toLowerCase().replace(/[^a-z]/g, '');
}

function getFieldTitle(field, locale = 'en') {
	const titleKeys = {
		appearance: 'appearance',
		backstory: 'backstory',
		encumbrance: 'encumbrance',
		equipment: 'equipment',
		firstname: 'firstName',
		goals: 'goals',
		inventory: 'inventory',
		level: 'level',
		lastname: 'lastName',
		name: 'name',
		personality: 'personality',
		race: 'race',
		racialtraits: 'racialTraits',
		rules: 'rules',
		statistics: 'statistics',
		status: 'status',
		statuseffects: 'statusEffects',
		talents: 'talents',
	};
	if (['ap', 'ar', 'hp', 'md'].includes(field)) {
		return getResourceAbbreviation(locale, field);
	}
	return titleKeys[field]
		? getCharacterFieldLabel(locale, titleKeys[field])
		: field.charAt(0).toUpperCase() + field.slice(1);
}

function formatList(items, maxLength = 1_024, locale = 'en') {
	if (items.length === 0) {
		return t(locale, 'common.empty');
	}
	return truncate(
		items.map((item, index) => `${index + 1}. ${item}`).join('\n'),
		maxLength,
	);
}

function formatLabel(value, locale = 'en') {
	return getCharacterFieldLabel(locale, `stats.${value}`);
}

function truncate(value, maxLength = 1_024) {
	if (value.length <= maxLength) {
		return value;
	}
	return `${value.slice(0, maxLength - 1)}…`;
}

module.exports = {
	createCharacterFieldEmbed,
	createCharacterSummaryEmbed,
	formatCharacterResource,
	formatCharacterResources,
};

const { EmbedBuilder } = require('discord.js');
const {
	BASE_STATS,
} = require('../services/mechanics/constants');
const {
	getCharacterFieldDefinition,
	getViewableFieldDefinition,
} = require('../services/characterFieldCatalog');
const {
	formatCombatantResource,
	formatCombatantResources,
} = require('./combatantDisplay');
const { getCharacterFieldLabel } = require('./characterDisplay');
const { formatDescribedRecords } = require('./describedRecordDisplay');
const {
	formatBlockList,
	formatNumberedBlockList,
	formatRuleList,
	formatStatistics,
	getStoredValue,
	truncate,
} = require('./entityRendererPrimitives');
const { t } = require('./i18n');

function createCharacterSummaryEmbed(character, locale = 'en') {
	const statusSections = [
		formatCombatantResources(character, ['hp', 'ar', 'ap', 'md'], locale),
	];
	if (character.status.effects.length > 0) {
		statusSections.push(
			`**${getCharacterFieldLabel(locale, 'status.effects')}**\n`
				+ formatList(character.status.effects, 1_024, locale),
		);
	}
	if (character.modifiers.length > 0) {
		statusSections.push(
			`**${getCharacterFieldLabel(locale, 'modifiers')}**\n`
				+ formatDescribedRecords(character.modifiers, 1_024, locale),
		);
	}
	const status = statusSections.join('\n\n');
	const stats = BASE_STATS
		.map(stat => `${formatLabel(stat, locale)}: **${character.statistics[stat]}**`)
		.join('\n');
	const racialTraits = [
		['race.traits.skillBonus', character.race.traits.skillBonus],
		['race.traits.physicalAbility', character.race.traits.physicalAbility],
	]
		.filter(([, value]) => hasText(value))
		.map(([field, value]) => `${getCharacterFieldLabel(locale, field)}: ${value}`);
	const leftColumn = [
		stats,
		...(racialTraits.length > 0 ? [
			`**${getCharacterFieldLabel(locale, 'race.traits')}**\n`
				+ truncate(racialTraits.join('\n'), 250),
		] : []),
	].join('\n\n');
	const rightSections = [];
	if (character.rules.length > 0) {
		rightSections.push({
			label: getCharacterFieldLabel(locale, 'rules'),
			value: formatList(
				character.rules.map(rule => t(locale, 'character.summary.ruleLevel', {
					level: rule.level,
					name: rule.name,
				})),
				250,
				locale,
			),
		});
	}
	if (character.talents.length > 0) {
		rightSections.push({
			label: getCharacterFieldLabel(locale, 'talents'),
			value: formatList(character.talents, 250, locale),
		});
	}
	const rightColumn = rightSections
		.map((section, index) => `${index === 0 ? '' : `**${section.label}**\n`}${section.value}`)
		.join('\n\n');
	const hasArchetype = hasText(character.background.archetype);
	const identity = hasText(character.race.name)
		? t(locale, hasArchetype
			? 'character.summary.identityWithArchetype'
			: 'character.summary.identity', {
			level: character.level,
			race: character.race.name,
			archetype: character.background.archetype,
		})
		: hasArchetype
			? t(locale, 'character.summary.levelWithArchetype', {
				level: character.level,
				archetype: character.background.archetype,
			})
			: `${getCharacterFieldLabel(locale, 'level')} **${character.level}**`;
	const backgroundDescription = [
		hasText(character.background.physicalDescription)
			? character.background.physicalDescription
			: null,
	].filter(Boolean);
	const description = [
		identity,
		...backgroundDescription,
	].join('\n');
	const summaryFields = [
		{ name: getCharacterFieldLabel(locale, 'status'), value: truncate(status) },
		{
			name: getCharacterFieldLabel(locale, 'statistics'),
			value: truncate(leftColumn),
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
		.setTitle(character.displayName)
		.setDescription(description)
		.setColor('#FFD700')
		.addFields(summaryFields);
}

function createCharacterFieldEmbed(character, fieldName, locale = 'en') {
	const definition = getViewableFieldDefinition(fieldName);
	if (!definition) {
		return null;
	}
	const field = definition.sectionId;
	const targets = definition.viewTargetIds.map(getCharacterFieldDefinition);
	const embed = new EmbedBuilder()
		.setTitle(t(locale, 'character.detail.title', {
			field: getCharacterFieldLabel(locale, field),
			name: character.displayName,
		}))
		.setColor('#FFD700');

	switch (field) {
	case 'name':
		return embed.addFields(
			...targets.map(target => ({
				name: getCharacterFieldLabel(locale, target.id),
				value: getStoredValue(character, target) || t(locale, 'common.empty'),
				inline: true,
			})),
		);
	case 'level':
		return embed.setDescription(String(getStoredValue(character, targets[0])));
	case 'status':
		return embed.addFields(
			...targets.filter(target => target.resourceId).map(target => ({
				name: getCharacterFieldLabel(locale, target.id),
				value: formatCombatantResource(character, target.resourceId, locale),
			})),
			{
				name: getCharacterFieldLabel(locale, targets.at(-1).id),
				value: formatList(
					getStoredValue(character, targets.at(-1)),
					1_024,
					locale,
				),
			},
		);
	case 'statistics':
		return embed.addFields(
			{
				name: getCharacterFieldLabel(locale, 'statistics.base'),
				value: formatStatTargets(character, targets.slice(0, BASE_STATS.length), locale),
				inline: true,
			},
			{
				name: getCharacterFieldLabel(locale, 'statistics.derived'),
				value: formatStatTargets(character, targets.slice(BASE_STATS.length), locale),
				inline: true,
			},
		);
	case 'rules':
		return embed.setDescription(formatRules(
			getStoredValue(character, targets[0]),
			locale,
		));
	case 'talents':
		return embed.setDescription(formatList(
			getStoredValue(character, targets[0]),
			4_096,
			locale,
		));
	case 'modifiers':
		return embed.setDescription(formatDescribedRecords(
			getStoredValue(character, targets[0]),
			4_096,
			locale,
		));
	case 'gear':
		return embed.addFields(
			...targets.filter(target => target.multiline).map(target => ({
				name: getCharacterFieldLabel(locale, target.id),
				value: formatList(getStoredValue(character, target), 1_024, locale),
			})),
			{
				name: getCharacterFieldLabel(locale, targets.at(-1).id),
				value: formatResource(
					getCharacterFieldLabel(locale, targets.at(-1).id),
					getPairValue(character, targets.at(-1)),
				),
				inline: true,
			},
		);
	case 'race':
		return embed.addFields(
			...targets.map(target => ({
				name: getCharacterFieldLabel(locale, target.id),
				value: truncate(
					getStoredValue(character, target) || t(locale, 'common.empty'),
				),
				...(['race.name', 'race.traits.skillBonus'].includes(target.id)
					? { inline: true }
					: {}),
			})),
		);
	case 'background':
		return embed.addFields(
			...targets.map(target => ({
				name: getCharacterFieldLabel(locale, target.id),
				value: truncate(
					getStoredValue(character, target) || t(locale, 'common.empty'),
				),
			})),
		);
	case 'personality':
		return embed.addFields(
			...targets.map(target => ({
				name: getCharacterFieldLabel(locale, target.id),
				value: target.multiline
					? formatList(getStoredValue(character, target), 1_024, locale)
					: truncate(
						getStoredValue(character, target) || t(locale, 'common.empty'),
					),
			})),
		);
	default:
		return null;
	}
}

function formatResource(label, resource) {
	return `${label}: **${resource.current} / ${resource.max}**`;
}

function formatStatTargets(character, targets, locale) {
	return formatStatistics(
		character,
		targets,
		target => getCharacterFieldLabel(locale, target.id),
	);
}

function getPairValue(character, definition) {
	const [current, maximum] = definition.inputTargetIds
		.map(getCharacterFieldDefinition)
		.map(target => getStoredValue(character, target));
	return { current, max: maximum };
}

function hasText(value) {
	return typeof value === 'string' && value.trim().length > 0;
}

function formatRules(rules, locale = 'en') {
	return formatRuleList(
		rules,
		(rule, index) => t(locale, 'character.detail.rule', {
			description: rule.description || t(locale, 'character.detail.noDescription'),
			index: index + 1,
			level: rule.level,
			name: rule.name,
		}),
		blocks => formatBlockList(blocks, '\n\n', 4_096, locale),
	);
}

function formatList(items, maxLength = 1_024, locale = 'en') {
	return formatNumberedBlockList(items, maxLength, locale);
}

function formatLabel(value, locale = 'en') {
	return getCharacterFieldLabel(locale, `statistics.${value}`);
}

module.exports = {
	createCharacterFieldEmbed,
	createCharacterSummaryEmbed,
};

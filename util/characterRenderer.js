const { EmbedBuilder } = require('discord.js');
const {
	getCharacterFieldDefinition,
	getViewableFieldDefinition,
} = require('../services/characterFieldCatalog');
const { getCharacterFieldLabel } = require('./characterDisplay');
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
	formatBlockList,
	formatNumberedBlockList,
	getStoredValue,
	truncate,
} = require('./entityRendererPrimitives');
const { t } = require('./i18n');

function createCharacterSummaryEmbed(character, locale = 'en') {
	const getLabel = fieldId => getCharacterFieldLabel(locale, fieldId);
	const status = formatCombatantSummaryStatus(character, getLabel, locale);
	const stats = formatCombatantSummaryStatistics(character, getLabel);
	const racialTraits = [
		['race.traits.skillBonus', character.race.traits.skillBonus],
		['race.traits.physicalAbility', character.race.traits.physicalAbility],
	]
		.filter(([, value]) => hasText(value))
		.map(([field, value]) => `${getLabel(field)}: ${value}`);
	const leftColumn = [
		stats,
		...(racialTraits.length > 0 ? [
			`**${getLabel('race.traits')}**\n`
				+ truncate(racialTraits.join('\n'), 250),
		] : []),
	].join('\n\n');
	const rightSections = [];
	if (character.rules.length > 0) {
		rightSections.push({
			label: getLabel('rules'),
			value: formatCombatantSummaryRules(
				character.rules,
				rule => t(locale, 'character.summary.ruleLevel', {
					level: rule.level,
					name: rule.name,
				}),
				formatList,
				250,
				locale,
			),
		});
	}
	if (character.talents.length > 0) {
		rightSections.push({
			label: getLabel('talents'),
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
			: `${getLabel('level')} **${character.level}**`;
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
		{ name: getLabel('status'), value: truncate(status) },
		{
			name: getLabel('statistics'),
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
	const getLabel = fieldId => getCharacterFieldLabel(locale, fieldId);
	const embed = new EmbedBuilder()
		.setTitle(t(locale, 'character.detail.title', {
			field: getLabel(field),
			name: character.displayName,
		}))
		.setColor('#FFD700');

	switch (field) {
	case 'name':
		return embed.addFields(
			...targets.map(target => ({
				name: getLabel(target.id),
				value: getStoredValue(character, target) || t(locale, 'common.empty'),
				inline: true,
			})),
		);
	case 'level':
		return embed.setDescription(String(getStoredValue(character, targets[0])));
	case 'resources':
		return embed.addFields(...formatCombatantResourceFields(
			character,
			targets,
			getLabel,
			locale,
		));
	case 'status':
		return embed.addFields(...formatCombatantStatusFields(
			character,
			targets,
			getLabel,
			locale,
		));
	case 'statistics':
		return embed.addFields(...formatCombatantStatisticsFields(
			character,
			targets,
			getLabel,
		));
	case 'rules':
		return embed.setDescription(formatCombatantRuleDetails(
			getStoredValue(character, targets[0]),
			(rule, index) => t(locale, 'character.detail.rule', {
				description: rule.description || t(locale, 'character.detail.noDescription'),
				index: index + 1,
				level: rule.level,
				name: rule.name,
			}),
			blocks => formatBlockList(blocks, '\n\n', 4_096, locale),
		));
	case 'talents':
		return embed.setDescription(formatList(
			getStoredValue(character, targets[0]),
			4_096,
			locale,
		));
	case 'gear':
		return embed.addFields(...formatCombatantGearFields(
			character,
			targets,
			getLabel,
			getCharacterFieldDefinition,
			{ locale, formatList, includeEncumbranceLabel: true },
		));
	case 'race':
		return embed.addFields(
			...targets.map(target => ({
				name: getLabel(target.id),
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
				name: getLabel(target.id),
				value: truncate(
					getStoredValue(character, target) || t(locale, 'common.empty'),
				),
			})),
		);
	case 'personality':
		return embed.addFields(
			...targets.map(target => ({
				name: getLabel(target.id),
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

function hasText(value) {
	return typeof value === 'string' && value.trim().length > 0;
}

function formatList(items, maxLength = 1_024, locale = 'en') {
	return formatNumberedBlockList(items, maxLength, locale);
}

module.exports = {
	createCharacterFieldEmbed,
	createCharacterSummaryEmbed,
};

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
const { t } = require('./i18n');

function createCharacterSummaryEmbed(character, locale = 'en') {
	const status = [
		formatCombatantResources(character, ['hp', 'ar', 'ap', 'md'], locale),
		'',
		`**${getCharacterFieldLabel(locale, 'status.effects')}**\n`
			+ formatList(character.status.effects, 1_024, locale),
		'',
		`**${getCharacterFieldLabel(locale, 'modifiers')}**\n`
			+ formatDescribedRecords(character.modifiers, 1_024, locale),
	].join('\n');
	const stats = BASE_STATS
		.map(stat => `${formatLabel(stat, locale)}: **${character.statistics[stat]}**`)
		.join('\n');
	const racialTraits = [
		`${getCharacterFieldLabel(locale, 'race.traits.skillBonus')}: `
			+ `${character.race.traits.skillBonus || t(locale, 'common.empty')}`,
		`${getCharacterFieldLabel(locale, 'race.traits.physicalAbility')}: `
			+ `${character.race.traits.physicalAbility || t(locale, 'common.empty')}`,
	].join('\n');
	const [leftColumn, rightColumn] = createSummaryColumns(
		[
			stats,
			truncate(racialTraits, 250),
			formatList(character.gear.equipment, 250, locale),
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
			formatList(character.gear.inventory, 250, locale),
		],
		[
			[
				getCharacterFieldLabel(locale, 'race.traits'),
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
			character.background.appearance
				|| t(locale, 'character.summary.unspecifiedAppearance'),
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
	return targets.map(target => (
		`${getCharacterFieldLabel(locale, target.id)}: **${getStoredValue(character, target)}**`
	)).join('\n');
}

function getStoredValue(character, definition) {
	return definition.path.reduce((value, key) => value[key], character);
}

function getPairValue(character, definition) {
	const [current, maximum] = definition.inputTargetIds
		.map(getCharacterFieldDefinition)
		.map(target => getStoredValue(character, target));
	return { current, max: maximum };
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
	const blocks = rules.map((rule, index) => t(locale, 'character.detail.rule', {
		description: rule.description || t(locale, 'character.detail.noDescription'),
		index: index + 1,
		level: rule.level,
		name: rule.name,
	}));
	return truncateBlocks(blocks, '\n\n', 4_096);
}

function formatList(items, maxLength = 1_024, locale = 'en') {
	if (items.length === 0) {
		return t(locale, 'common.empty');
	}
	return truncateBlocks(
		items.map((item, index) => `${index + 1}. ${item}`),
		'\n',
		maxLength,
	);
}

function formatLabel(value, locale = 'en') {
	return getCharacterFieldLabel(locale, `statistics.${value}`);
}

function truncate(value, maxLength = 1_024) {
	if (value.length <= maxLength) {
		return value;
	}
	return `${value.slice(0, maxLength - 1)}…`;
}

function truncateBlocks(blocks, separator, maxLength) {
	const included = [];
	for (const block of blocks) {
		const prefixLength = included.length === 0 ? 0 : separator.length;
		const remaining = maxLength - included.join(separator).length - prefixLength;
		if (block.length <= remaining) {
			included.push(block);
			continue;
		}
		if (included.length === 0) {
			included.push(truncate(block, maxLength));
		}
		else {
			const current = included.join(separator);
			if (current.length + separator.length + 1 <= maxLength) {
				included.push('...');
			}
		}
		break;
	}
	return included.join(separator);
}

module.exports = {
	createCharacterFieldEmbed,
	createCharacterSummaryEmbed,
};

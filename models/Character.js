const { EmbedBuilder } = require('discord.js');
const {
	BASE_STATS,
	DERIVED_STATS,
	MAX_AP,
} = require('../services/mechanics/constants');
const {
	copyRules,
	copyStringList,
} = require('../services/mechanics/characterValidation');
const {
	clampActionPoints,
	createResourcesFromSave,
} = require('../services/mechanics/resources');
const { createStats } = require('../services/mechanics/statistics');
const { t } = require('../util/i18n');
const {
	getCharacterFieldLabel,
	getResourceAbbreviation,
} = require('../util/characterDisplay');

class Character {
	static fromSave(data, characterKey = data.key) {
		const character = new Character(characterKey, data.creatorId);
		character.firstName = data.firstName ?? '';
		character.lastName = data.lastName ?? '';
		character.level = data.level ?? 1;
		character.race = {
			name: data.race?.name ?? '',
			physicalDescription: data.race?.physicalDescription ?? '',
			lore: data.race?.lore ?? '',
		};
		character.appearance = data.appearance ?? '';
		character.backstory = data.backstory ?? '';
		character.goals = data.goals ?? '';
		character.personality = {
			traits: copyStringList(data.personality?.traits),
			description: data.personality?.description ?? '',
		};
		character.racialTraits = {
			skillBonus: data.racialTraits?.skillBonus ?? '',
			physicalAbility: data.racialTraits?.physicalAbility ?? '',
		};
		character.stats = createStats(data.stats);
		character.rules = copyRules(data.rules);
		character.talents = data.talents ?? '';
		character.resources = createResourcesFromSave(data);
		character.statusEffects = copyStringList(data.statusEffects);
		character.equipment = copyStringList(data.equipment);
		character.inventory = copyStringList(data.inventory);
		character.encumbrance = {
			current: data.encumbrance?.current ?? 0,
			max: data.encumbrance?.max ?? character.stats.constitution,
		};
		return character;
	}

	constructor(key, creatorId) {
		this.key = key;
		this.firstName = '';
		this.lastName = '';
		this.creatorId = creatorId;
		this.level = 1;
		this.race = {
			name: '',
			physicalDescription: '',
			lore: '',
		};
		this.appearance = '';
		this.backstory = '';
		this.goals = '';
		this.personality = {
			traits: [],
			description: '',
		};
		this.racialTraits = {
			skillBonus: '',
			physicalAbility: '',
		};
		this.stats = createStats();
		this.rules = [];
		this.talents = '';
		this.resources = {
			hp: { current: 100, max: 100 },
			ar: { current: 0, max: 0 },
			ap: { current: 4, max: 4 },
			md: { current: 5, max: 5 },
		};
		this.statusEffects = [];
		this.equipment = [];
		this.inventory = [];
		this.encumbrance = {
			current: 0,
			max: this.stats.constitution,
		};
	}

	get displayName() {
		return [this.firstName, this.lastName].filter(Boolean).join(' ') || this.key;
	}

	toEmbed(locale = 'en') {
		const status = [
			formatProgressResource(
				getResourceAbbreviation(locale, 'hp'),
				this.resources.hp,
				'❤️',
				'🖤',
			),
			formatProgressResource(
				getResourceAbbreviation(locale, 'ar'),
				this.resources.ar,
				'🟦',
				'⬛',
			),
			formatAp(this.resources.ap, locale),
			formatProgressResource(
				getResourceAbbreviation(locale, 'md'),
				this.resources.md,
				'🟧',
				'⬛',
			),
			'',
			`**${getCharacterFieldLabel(locale, 'statusEffects')}**\n`
				+ formatList(this.statusEffects, 1_024, locale),
		].join('\n');
		const stats = BASE_STATS
			.map(stat => `${formatLabel(stat, locale)}: **${this.stats[stat]}**`)
			.join('\n');
		const racialTraits = [
			`${getCharacterFieldLabel(locale, 'racialTraits.skillBonus')}: `
				+ `${this.racialTraits.skillBonus || t(locale, 'common.empty')}`,
			`${getCharacterFieldLabel(locale, 'racialTraits.physicalAbility')}: `
				+ `${this.racialTraits.physicalAbility || t(locale, 'common.empty')}`,
		].join('\n');
		const [leftColumn, rightColumn] = createSummaryColumns(
			[
				stats,
				truncate(racialTraits, 250),
				formatList(this.equipment, 250, locale),
			],
			[
				formatList(
					this.rules.map(rule => t(locale, 'character.summary.ruleLevel', {
						level: rule.level,
						name: rule.name,
					})),
					250,
					locale,
				),
				truncate(this.talents || t(locale, 'common.empty'), 250),
				formatList(this.inventory, 250, locale),
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
			.setTitle(this.displayName)
			.setDescription([
				t(locale, 'character.summary.identity', {
					level: this.level,
					race: this.race.name || t(locale, 'character.summary.unspecifiedRace'),
				}),
				this.appearance || t(locale, 'character.summary.unspecifiedAppearance'),
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

	toFieldEmbed(fieldName, locale = 'en') {
		const field = normalizeFieldName(fieldName);
		const embed = new EmbedBuilder()
			.setTitle(t(locale, 'character.detail.title', {
				field: getFieldTitle(field, locale),
				name: this.displayName,
			}))
			.setColor('#FFD700');

		switch (field) {
			case 'name':
				return embed.addFields(
					{
						name: getCharacterFieldLabel(locale, 'firstName'),
						value: this.firstName || t(locale, 'common.empty'),
						inline: true,
					},
					{
						name: getCharacterFieldLabel(locale, 'lastName'),
						value: this.lastName || t(locale, 'common.empty'),
						inline: true,
					},
				);
			case 'firstname':
				return embed.setDescription(this.firstName || t(locale, 'common.empty'));
			case 'lastname':
				return embed.setDescription(this.lastName || t(locale, 'common.empty'));
			case 'level':
				return embed.setDescription(String(this.level));
			case 'race':
				return embed.addFields(
					{
						name: getCharacterFieldLabel(locale, 'race.name'),
						value: truncate(this.race.name || t(locale, 'common.empty')),
					},
					{
						name: getCharacterFieldLabel(locale, 'race.physicalDescription'),
						value: truncate(this.race.physicalDescription || t(locale, 'common.empty')),
					},
					{
						name: getCharacterFieldLabel(locale, 'race.lore'),
						value: truncate(this.race.lore || t(locale, 'common.empty')),
					},
				);
			case 'appearance':
				return embed.setDescription(truncate(
					this.appearance || t(locale, 'common.empty'),
					4_096,
				));
			case 'backstory':
				return embed.setDescription(truncate(
					this.backstory || t(locale, 'common.empty'),
					4_096,
				));
			case 'goals':
				return embed.setDescription(truncate(
					this.goals || t(locale, 'common.empty'),
					4_096,
				));
			case 'personality':
				return embed.addFields(
					{
						name: getCharacterFieldLabel(locale, 'personality.traits'),
						value: formatList(this.personality.traits, 1_024, locale),
					},
					{
						name: getCharacterFieldLabel(locale, 'personality.description'),
						value: truncate(
							this.personality.description || t(locale, 'common.empty'),
						),
					},
				);
			case 'racialtraits':
				return embed.addFields(
					{
						name: getCharacterFieldLabel(locale, 'racialTraits.skillBonus'),
						value: truncate(
							this.racialTraits.skillBonus || t(locale, 'common.empty'),
						),
					},
					{
						name: getCharacterFieldLabel(locale, 'racialTraits.physicalAbility'),
						value: truncate(
							this.racialTraits.physicalAbility || t(locale, 'common.empty'),
						),
					},
				);
			case 'statistics':
				return embed.addFields(
					{
						name: getCharacterFieldLabel(locale, 'statistics.base'),
						value: formatStats(this.stats, BASE_STATS, locale),
						inline: true,
					},
					{
						name: getCharacterFieldLabel(locale, 'statistics.derived'),
						value: formatStats(this.stats, DERIVED_STATS, locale),
						inline: true,
					},
				);
			case 'rules':
				return embed.setDescription(formatRules(this.rules, locale));
			case 'talents':
				return embed.setDescription(truncate(
					this.talents || t(locale, 'common.empty'),
					4_096,
				));
			case 'status':
				return embed.setDescription(formatDetailedStatus(this, locale));
			case 'statuseffects':
				return embed.setDescription(formatList(this.statusEffects, 1_024, locale));
			case 'equipment':
				return embed.setDescription(formatList(this.equipment, 1_024, locale));
			case 'inventory':
				return embed.setDescription(formatList(this.inventory, 1_024, locale));
			case 'encumbrance':
				return embed.setDescription(formatResource(
					getCharacterFieldLabel(locale, 'encumbrance'),
					this.encumbrance,
				));
			default:
				if (['hp', 'ar', 'md'].includes(field)) {
					const icons = {
						hp: ['❤️', '🖤'],
						ar: ['🟦', '⬛'],
						md: ['🟧', '⬛'],
					};
					return embed.setDescription(
						formatProgressResource(
							getResourceAbbreviation(locale, field),
							this.resources[field],
							icons[field][0],
							icons[field][1],
						),
					);
				}
				if (field === 'ap') {
					return embed.setDescription(formatAp(this.resources.ap, locale));
				}
				return null;
		}
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

function formatDetailedStatus(character, locale = 'en') {
	return truncate([
		formatProgressResource(
			getResourceAbbreviation(locale, 'hp'),
			character.resources.hp,
			'❤️',
			'🖤',
		),
		formatProgressResource(
			getResourceAbbreviation(locale, 'ar'),
			character.resources.ar,
			'🟦',
			'⬛',
		),
		formatAp(character.resources.ap, locale),
		formatProgressResource(
			getResourceAbbreviation(locale, 'md'),
			character.resources.md,
			'🟧',
			'⬛',
		),
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
	const normalized = value.toLowerCase().replace(/[^a-z]/g, '');
	const aliases = {
		racialtrait: 'racialtraits',
		stats: 'statistics',
		rule: 'rules',
		statuseffect: 'statuseffects',
	};
	return aliases[normalized] ?? normalized;
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

module.exports = Character;
module.exports.BASE_STATS = BASE_STATS;
module.exports.DERIVED_STATS = DERIVED_STATS;
module.exports.MAX_AP = MAX_AP;

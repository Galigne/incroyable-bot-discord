const { EmbedBuilder } = require('discord.js');

const BASE_STATS = [
	'constitution',
	'strength',
	'dexterity',
	'intelligence',
	'speed',
	'perception',
	'charisma',
];
const DERIVED_STATS = ['initiative', 'reflexes'];
const MAX_AP = 10;

class Character {
	static fromSave(data) {
		const character = new Character(data.name, data.creatorId);
		character.level = data.level ?? 1;
		character.race = {
			name: data.race?.name ?? '',
			physicalDescription: data.race?.physicalDescription ?? '',
			lore: data.race?.lore ?? '',
		};
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
		character.resources = createResources(data);
		character.statusEffects = copyStringList(data.statusEffects);
		character.equipment = copyStringList(
			data.equipment ?? data.inventory?.equipment,
		);
		character.inventory = copyStringList(
			Array.isArray(data.inventory) ? data.inventory : data.inventory?.bag,
		);
		character.encumbrance = {
			current: data.encumbrance?.current ?? 0,
			max: data.encumbrance?.max ?? character.stats.constitution,
		};
		return character;
	}

	constructor(name, creatorId) {
		this.name = name;
		this.creatorId = creatorId;
		this.level = 1;
		this.race = {
			name: '',
			physicalDescription: '',
			lore: '',
		};
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

	toEmbed() {
		const status = [
			formatProgressResource('HP', this.resources.hp, '❤️', '🤍'),
			formatProgressResource('AR', this.resources.ar, '🟦', '⬛'),
			formatAp(this.resources.ap),
			formatProgressResource('MD', this.resources.md, '🟨', '⬛'),
			'',
			`**Status effects**\n${formatList(this.statusEffects)}`,
		].join('\n');
		const stats = [...BASE_STATS, ...DERIVED_STATS]
			.map(stat => `${formatLabel(stat)}: **${this.stats[stat]}**`)
			.join('\n');
		const racialTraits = [
			`Skill bonus: ${this.racialTraits.skillBonus || '—'}`,
			`Physical ability: ${this.racialTraits.physicalAbility || '—'}`,
		].join('\n');
		const [leftColumn, rightColumn] = createSummaryColumns(
			[
				stats,
				truncate(racialTraits, 250),
				formatList(this.equipment, 250),
			],
			[
				formatList(this.rules.map(rule => rule.name), 250),
				truncate(this.talents || '—', 250),
				formatList(this.inventory, 250),
			],
			[
				['Racial traits', 'Talents'],
				['Equipment', 'Inventory'],
			],
		);

		return new EmbedBuilder()
			.setTitle(this.name)
			.setDescription(
				`Level **${this.level}** · Race **${this.race.name || 'Unspecified'}**`,
			)
			.setColor('#FFD700')
			.addFields(
				{ name: 'Status', value: truncate(status) },
				{
					name: 'Statistics',
					value: leftColumn,
					inline: true,
				},
				{
					name: 'RULEs',
					value: rightColumn,
					inline: true,
				},
			);
	}

	toFieldEmbed(fieldName) {
		const field = normalizeFieldName(fieldName);
		const embed = new EmbedBuilder()
			.setTitle(`${this.name} — ${getFieldTitle(field)}`)
			.setColor('#FFD700');

		switch (field) {
			case 'name':
				return embed.setDescription(this.name || '—');
			case 'level':
				return embed.setDescription(String(this.level));
			case 'race':
				return embed.addFields(
					{ name: 'Name', value: truncate(this.race.name || '—') },
					{
						name: 'Physical description',
						value: truncate(this.race.physicalDescription || '—'),
					},
					{ name: 'Lore', value: truncate(this.race.lore || '—') },
				);
			case 'backstory':
				return embed.setDescription(truncate(this.backstory || '—', 4_096));
			case 'goals':
				return embed.setDescription(truncate(this.goals || '—', 4_096));
			case 'personality':
				return embed.addFields(
					{ name: 'Traits', value: formatList(this.personality.traits) },
					{
						name: 'Additional description',
						value: truncate(this.personality.description || '—'),
					},
				);
			case 'racialtraits':
				return embed.addFields(
					{
						name: 'Skill bonus',
						value: truncate(this.racialTraits.skillBonus || '—'),
					},
					{
						name: 'Physical ability',
						value: truncate(this.racialTraits.physicalAbility || '—'),
					},
				);
			case 'statistics':
				return embed.addFields(
					{ name: 'Base statistics', value: formatStats(this.stats, BASE_STATS), inline: true },
					{
						name: 'Derived statistics',
						value: formatStats(this.stats, DERIVED_STATS),
						inline: true,
					},
				);
			case 'rules':
				return embed.setDescription(formatRules(this.rules));
			case 'talents':
				return embed.setDescription(truncate(this.talents || '—', 4_096));
			case 'status':
				return embed.setDescription(formatDetailedStatus(this));
			case 'statuseffects':
				return embed.setDescription(formatList(this.statusEffects));
			case 'equipment':
				return embed.setDescription(formatList(this.equipment));
			case 'inventory':
				return embed.setDescription(formatList(this.inventory));
			case 'encumbrance':
				return embed.setDescription(formatResource('Encumbrance', this.encumbrance));
			default:
				if (['hp', 'ar', 'md'].includes(field)) {
					const icons = {
						hp: ['❤️', '🤍'],
						ar: ['🟦', '⬛'],
						md: ['🟨', '⬛'],
					};
					return embed.setDescription(
						formatProgressResource(
							field.toUpperCase(),
							this.resources[field],
							icons[field][0],
							icons[field][1],
						),
					);
				}
				if (field === 'ap') {
					return embed.setDescription(formatAp(this.resources.ap));
				}
				return null;
		}
	}
}

function createStats(data = {}) {
	const stats = {};
	for (const stat of BASE_STATS) {
		stats[stat] = data[stat] ?? 10;
	}
	stats.initiative = data.initiative ?? data.speed ?? 10;
	stats.reflexes = data.reflexes ?? data.speed ?? 10;
	return stats;
}

function createResources(data) {
	const apMax = clampAp(data.resources?.ap?.max ?? 4);
	return {
		hp: {
			current: data.resources?.hp?.current ?? data.battle?.currentHp ?? 100,
			max: data.resources?.hp?.max ?? data.battle?.maxHp ?? 100,
		},
		ar: {
			current: data.resources?.ar?.current ?? data.battle?.armor ?? 0,
			max: data.resources?.ar?.max ?? data.battle?.armor ?? 0,
		},
		ap: {
			current: Math.min(clampAp(data.resources?.ap?.current ?? 4), apMax),
			max: apMax,
		},
		md: {
			current: data.resources?.md?.current ?? 5,
			max: data.resources?.md?.max ?? 5,
		},
	};
}

function copyStringList(value) {
	return Array.isArray(value) ? value.filter(item => typeof item === 'string') : [];
}

function copyRules(value) {
	if (!Array.isArray(value)) {
		return [];
	}
	return value
		.filter(rule => rule && typeof rule.name === 'string')
		.map(rule => ({
			name: rule.name,
			description: typeof rule.description === 'string' ? rule.description : '',
		}));
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

function formatAp(resource) {
	const maxAp = clampAp(resource.max);
	const availableAp = Math.min(clampAp(resource.current), maxAp);
	const spentAp = maxAp - availableAp;
	return `AP:\n${'🌟'.repeat(availableAp)}${'⭐'.repeat(spentAp) || (maxAp === 0 ? '—' : '')}`;
}

function formatDetailedStatus(character) {
	return truncate([
		formatProgressResource('HP', character.resources.hp, '❤️', '🤍'),
		formatProgressResource('AR', character.resources.ar, '🟦', '⬛'),
		formatAp(character.resources.ap),
		formatProgressResource('MD', character.resources.md, '🟨', '⬛'),
		formatResource('Encumbrance', character.encumbrance),
		'',
		`**Status effects**\n${formatList(character.statusEffects)}`,
	].join('\n'), 4_096);
}

function getResourcePercentage(resource) {
	if (resource.max <= 0) {
		return 0;
	}
	return Math.max(0, Math.min(100, Math.round(resource.current / resource.max * 100)));
}

function clampAp(value) {
	if (!Number.isFinite(value)) {
		return 0;
	}
	return Math.max(0, Math.min(MAX_AP, Math.round(value)));
}

function formatStats(stats, statNames) {
	return statNames
		.map(stat => `${formatLabel(stat)}: **${stats[stat]}**`)
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

function formatRules(rules) {
	if (rules.length === 0) {
		return '—';
	}
	const value = rules.map((rule, index) => (
		`**${index + 1}. ${rule.name}**\n${rule.description || 'No description.'}`
	)).join('\n\n');
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

function getFieldTitle(field) {
	const titles = {
		ap: 'AP',
		ar: 'AR',
		backstory: 'Backstory',
		encumbrance: 'Encumbrance',
		equipment: 'Equipment',
		goals: 'Goals',
		hp: 'HP',
		inventory: 'Inventory',
		level: 'Level',
		md: 'MD',
		name: 'Name',
		personality: 'Personality',
		race: 'Race',
		racialtraits: 'Racial traits',
		rules: 'RULEs',
		statistics: 'Statistics',
		status: 'Status',
		statuseffects: 'Status effects',
		talents: 'Talents',
	};
	return titles[field] ?? formatLabel(field);
}

function formatList(items, maxLength = 1_024) {
	if (items.length === 0) {
		return '—';
	}
	return truncate(
		items.map((item, index) => `${index + 1}. ${item}`).join('\n'),
		maxLength,
	);
}

function formatLabel(value) {
	return value.charAt(0).toUpperCase() + value.slice(1);
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

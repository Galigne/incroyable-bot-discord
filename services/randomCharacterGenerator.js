const { BASE_STATS } = require('../models/Character');
const generatorCatalog = require('./generatorCatalog');

const BASE_STAT_BUDGET = 67;
const MIN_STAT = 4;
const MAX_STAT = 20;
const RULE_POINT_THRESHOLDS = [10, 12, 14, 16, 18, 20];
const BONUS_STAT_LEVELS = [2, 5, 8];
const TALENT_LEVELS = [3, 6, 9];

function populateRandomCharacter(character, options = {}) {
	const random = options.random ?? Math.random;
	const level = options.level ?? randomInteger(1, 10, random);
	if (!Number.isInteger(level) || level < 1 || level > 10) {
		throw generationError('Character level must be a whole number between 1 and 10.');
	}

	character.level = level;
	const generatedName = pickOne('name', random);
	character.firstName = getField(generatedName, 'FirstName');
	character.lastName = getField(generatedName, 'LastName');

	const race = pickOne('race', random);
	character.race.name = getField(race, 'Name');
	character.race.physicalDescription = getField(race, 'Description');
	character.racialTraits.skillBonus = getField(race, 'Skill Bonus');
	character.racialTraits.physicalAbility = getField(race, 'Physical Ability');

	const background = resolveBackground(options.background, random);
	const backgroundDetails = pickOne(getField(background, 'Generator'), random);
	character.appearance = getField(backgroundDetails, 'Appearance');
	character.backstory = getField(backgroundDetails, 'Backstory');
	character.goals = getField(backgroundDetails, 'Goals');

	character.personality.traits = pickMany('personality', 2, random)
		.map(getTextValue);
	character.stats = generateStats(level, random);

	const rulePointCount = calculateRulePoints(character.stats.intelligence);
	const ruleLevels = allocateRuleLevels(rulePointCount);
	character.rules = pickMany('rules', ruleLevels.length, random)
		.map((entry, index) => ({
			name: getField(entry, 'Name'),
			description: getField(entry, 'Description'),
			level: ruleLevels[index],
		}));

	const talentCount = 1 + TALENT_LEVELS.filter(requiredLevel => level >= requiredLevel).length;
	character.talents = pickMany('talents', talentCount, random)
		.map(entry => `${getField(entry, 'Name')} — ${getField(entry, 'Description')}`)
		.join('\n');

	character.statusEffects = random() < 0.25
		? [getTextValue(pickOne('statusEffect', random))]
		: [];

	const maxHp = Math.round(
		character.stats.constitution * 10 * (1 + 0.2 * (level - 1)),
	);
	const maxAp = calculateMaxAp(level);
	const maxMd = character.stats.speed * 0.5;

	const armor = pickOne(
		'armors',
		random,
		entry => Number(getField(entry, 'Constitution requirement'))
			<= character.stats.constitution,
	);
	const weaponCount = randomInteger(1, 2, random);
	const weapons = pickMany('weapons', weaponCount, random);
	const inventoryItems = pickMany('inventory', 3, random);
	const armorPercentage = Number(getField(armor, 'AR percentage'));

	character.resources.hp = { current: maxHp, max: maxHp };
	character.resources.ar = {
		current: Math.round(maxHp * armorPercentage / 100),
		max: Math.round(maxHp * armorPercentage / 100),
	};
	character.resources.ap = { current: maxAp, max: maxAp };
	character.resources.md = { current: maxMd, max: maxMd };
	character.equipment = [
		formatNamedEntry(armor),
		...weapons.map(formatNamedEntry),
	];

	const gold = level * randomInteger(1, 20, random) + 5;
	character.inventory = [
		...inventoryItems.map(formatNamedEntry),
		`${gold} gold`,
	];
	character.encumbrance = {
		current: [armor, ...weapons, ...inventoryItems]
			.reduce((total, entry) => total + Number(getField(entry, 'Encumbrance')), 0),
		max: character.stats.constitution,
	};

	return character;
}

function resolveBackground(requestedBackground, random) {
	if (!requestedBackground) {
		return pickOne('background', random);
	}
	const backgroundCategory = generatorCatalog.getCategory('background');
	const normalizedRequest = generatorCatalog.normalizeCategoryName(requestedBackground);
	const background = backgroundCategory?.entries.find(entry => (
		generatorCatalog.normalizeCategoryName(getField(entry, 'Name')) === normalizedRequest
	));
	if (!background) {
		throw generationError(`Unknown background category: ${requestedBackground}.`);
	}
	return background;
}

function generateStats(level, random = Math.random) {
	const stats = Object.fromEntries(BASE_STATS.map(stat => [stat, MIN_STAT]));
	let remainingPoints = calculateStatBudget(level)
		- BASE_STATS.length * MIN_STAT;

	while (remainingPoints > 0) {
		const eligibleStats = BASE_STATS.filter(stat => (
			stats[stat] < MAX_STAT
			&& getNextStatCost(stats[stat]) <= remainingPoints
		));
		if (eligibleStats.length === 0) {
			throw generationError(`Could not spend ${remainingPoints} remaining stat points.`);
		}
		const stat = eligibleStats[randomIndex(eligibleStats.length, random)];
		remainingPoints -= getNextStatCost(stats[stat]);
		stats[stat] += 1;
	}

	stats.initiative = stats.speed;
	stats.reflexes = stats.speed;
	return stats;
}

function calculateStatBudget(level) {
	return BASE_STAT_BUDGET
		+ 2 * (level - 1)
		+ BONUS_STAT_LEVELS.filter(requiredLevel => level >= requiredLevel).length;
}

function calculateStatCost(stats) {
	return BASE_STATS.reduce((total, stat) => {
		let cost = 0;
		for (let value = 1; value <= stats[stat]; value += 1) {
			cost += getValueCost(value);
		}
		return total + cost;
	}, 0);
}

function getNextStatCost(currentValue) {
	return getValueCost(currentValue + 1);
}

function getValueCost(value) {
	if (value <= 14) {
		return 1;
	}
	if (value <= 16) {
		return 2;
	}
	if (value <= 18) {
		return 3;
	}
	return 4;
}

function calculateRulePoints(intelligence) {
	return RULE_POINT_THRESHOLDS.filter(threshold => intelligence >= threshold).length;
}

function allocateRuleLevels(rulePoints) {
	if (!Number.isInteger(rulePoints) || rulePoints < 0) {
		throw generationError('RULE points must be a non-negative whole number.');
	}

	const levels = [];
	let remainingPoints = rulePoints;
	for (let ruleIndex = 0; ruleIndex < 2 && remainingPoints > 0; ruleIndex += 1) {
		let level = 0;
		while (remainingPoints >= level + 1) {
			level += 1;
			remainingPoints -= level;
		}
		levels.push(level);
	}
	return levels;
}

function calculateMaxAp(level) {
	return 4
		+ (level >= 4 ? 1 : 0)
		+ (level >= 7 ? 1 : 0)
		+ (level >= 10 ? 2 : 0);
}

function pickOne(categoryName, random, predicate = () => true) {
	return pickMany(categoryName, 1, random, predicate)[0];
}

function pickMany(categoryName, count, random, predicate = () => true) {
	const category = generatorCatalog.getCategory(categoryName);
	if (!category) {
		throw generationError(`Missing generator category: ${categoryName}.`);
	}
	const availableEntries = category.entries.filter(predicate);
	if (availableEntries.length < count) {
		throw generationError(
			`Generator category ${categoryName} needs at least ${count} eligible entries.`,
		);
	}

	const selectedEntries = [];
	for (let index = 0; index < count; index += 1) {
		const entry = generatorCatalog.selectWeightedEntry(availableEntries, random);
		selectedEntries.push(entry);
		availableEntries.splice(availableEntries.indexOf(entry), 1);
	}
	return selectedEntries;
}

function getField(entry, requestedField) {
	if (!entry?.fields) {
		throw generationError(`Expected a structured generator entry with ${requestedField}.`);
	}
	const matchingField = Object.keys(entry.fields)
		.find(field => field.toLowerCase() === requestedField.toLowerCase());
	if (!matchingField) {
		throw generationError(`Generator entry is missing field: ${requestedField}.`);
	}
	return entry.fields[matchingField];
}

function getTextValue(entry) {
	if (typeof entry === 'string') {
		return entry;
	}
	if (entry?.value !== undefined) {
		return entry.value;
	}
	throw generationError('Expected a text generator entry.');
}

function formatNamedEntry(entry) {
	const name = getField(entry, 'Name');
	const description = getField(entry, 'Description');
	return `${name} — ${description}`;
}

function randomInteger(min, max, random) {
	return min + randomIndex(max - min + 1, random);
}

function randomIndex(length, random) {
	const randomValue = Math.max(0, Math.min(0.9999999999999999, random()));
	return Math.floor(randomValue * length);
}

function generationError(message) {
	const error = new Error(message);
	error.code = 'INVALID_RANDOM_CHARACTER';
	return error;
}

module.exports = {
	allocateRuleLevels,
	calculateMaxAp,
	calculateRulePoints,
	calculateStatBudget,
	calculateStatCost,
	generateStats,
	populateRandomCharacter,
};

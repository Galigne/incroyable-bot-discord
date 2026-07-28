const { BASE_STATS } = require('./constants');
const { recalculateDerivedStats } = require('./statistics');

const BASE_STAT_BUDGET = 67;
const MIN_STAT = 4;
const MAX_STAT = 20;
const RULE_POINT_THRESHOLDS = [10, 12, 14, 16, 18, 20];
const BONUS_STAT_LEVELS = [2, 5, 8];
const TALENT_LEVELS = [3, 6, 9];

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

	return recalculateDerivedStats(stats);
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

function calculateTalentCount(level) {
	return 1 + TALENT_LEVELS.filter(requiredLevel => level >= requiredLevel).length;
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
	calculateRulePoints,
	calculateStatBudget,
	calculateStatCost,
	calculateTalentCount,
	generateStats,
};

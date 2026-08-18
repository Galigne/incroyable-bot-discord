const { BASE_STATS } = require('./constants');
const { recalculateDerivedStats } = require('./statistics');
const { validateStatProfile } = require('../statProfileCatalog');
const { selectWeightedEntry } = require('../weightedSelector');

const BASE_STAT_BUDGET = 67;
const MAX_STAT = 20;
const BONUS_STAT_LEVELS = [2, 5, 8];

function generateStats({ level, profile, random = Math.random }) {
	if (!Number.isInteger(level) || level < 1 || level > 10) {
		throw generationError('Character level must be a whole number between 1 and 10.');
	}
	validateStatProfile(profile);
	const stats = Object.fromEntries(
		BASE_STATS.map(stat => [stat, profile.minimums[stat]]),
	);
	let remainingPoints = calculateStatBudget(level) - calculateStatCost(stats);

	while (remainingPoints > 0) {
		const eligibleStats = BASE_STATS.filter(stat => (
			stats[stat] < MAX_STAT
			&& stats[stat] < profile.maximums[stat]
			&& profile.weights[stat] > 0
			&& getNextStatCost(stats[stat]) <= remainingPoints
		)).map(stat => ({ stat, weight: profile.weights[stat] }));
		if (eligibleStats.length === 0) {
			break;
		}
		const { stat } = selectWeightedEntry(eligibleStats, random);
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

function generationError(message) {
	const error = new Error(message);
	error.code = 'INVALID_RANDOM_CHARACTER';
	return error;
}

module.exports = {
	calculateStatBudget,
	calculateStatCost,
	generateStats,
};

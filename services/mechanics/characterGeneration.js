const RULE_POINT_THRESHOLDS = [10, 12, 14, 16, 18, 20];
const TALENT_LEVELS = [3, 6, 9];

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

function generationError(message) {
	const error = new Error(message);
	error.code = 'INVALID_RANDOM_CHARACTER';
	return error;
}

module.exports = {
	allocateRuleLevels,
	calculateRulePoints,
	calculateTalentCount,
};

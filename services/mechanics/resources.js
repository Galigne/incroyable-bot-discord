const { MAX_AP } = require('./constants');
const { combatantEditError } = require('./combatantValidation');
const { characterEditError } = require('./characterValidation');
const { calculateArmorRating } = require('./armor');

function calculateMaxHp(constitution, level) {
	return Math.round(constitution * 10 * (1 + 0.2 * (level - 1)));
}

function calculateMaxAp(level) {
	return 4
		+ (level >= 4 ? 1 : 0)
		+ (level >= 7 ? 1 : 0)
		+ (level >= 10 ? 2 : 0);
}

function calculateMaxMovementDistance(speed) {
	return speed * 0.5;
}

function createGeneratedResources(stats, level, armorPercentage) {
	const maxHp = calculateMaxHp(stats.constitution, level);
	const maxAr = calculateArmorRating(maxHp, armorPercentage);
	const maxAp = calculateMaxAp(level);
	const maxMd = calculateMaxMovementDistance(stats.speed);
	return {
		hp: createFullResource(maxHp),
		ar: createFullResource(maxAr),
		ap: createFullResource(maxAp),
		md: createFullResource(maxMd),
	};
}

function calculateRestoredResourceValue(maximum, percentage) {
	validateRestorationPercentage(percentage);
	return Math.min(maximum, Math.round(maximum * percentage / 100));
}

function restoreResource(character, resourceName, percentage) {
	const resource = resourceName.toLowerCase();
	if (!['hp', 'ar'].includes(resource)) {
		throw combatantEditError(character, 'errors.healResourcesOnly');
	}
	validateRestorationPercentage(percentage, character);
	const target = character.resources[resource];
	target.current = calculateRestoredResourceValue(target.max, percentage);
	return target;
}

function restoreHealingResources(character, resourceName, percentage) {
	const resourceKeys = {
		hp: ['hp'],
		armor: ['ar'],
		both: ['hp', 'ar'],
	}[resourceName];
	if (!resourceKeys) {
		throw combatantEditError(character, 'errors.healResourceInvalid');
	}
	validateRestorationPercentage(percentage, character);

	return resourceKeys.map(resource => {
		const target = character.resources[resource];
		const previous = target.current;
		restoreResource(character, resource, percentage);
		return {
			resource,
			previous,
			current: target.current,
			max: target.max,
		};
	});
}

function resetTurnResources(character) {
	character.resources.ap.current = character.resources.ap.max;
	character.resources.md.current = character.resources.md.max;
}

function validateRestorationPercentage(percentage, combatant = null) {
	if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
		throw combatant
			? combatantEditError(combatant, 'errors.percentageInvalid')
			: characterEditError('errors.percentageInvalid');
	}
}

function clampActionPoints(value) {
	if (!Number.isFinite(value)) {
		return 0;
	}
	return Math.max(0, Math.min(MAX_AP, Math.round(value)));
}

function createFullResource(maximum) {
	return { current: maximum, max: maximum };
}

module.exports = {
	calculateMaxAp,
	calculateMaxHp,
	calculateMaxMovementDistance,
	calculateRestoredResourceValue,
	clampActionPoints,
	createGeneratedResources,
	resetTurnResources,
	restoreHealingResources,
	restoreResource,
};

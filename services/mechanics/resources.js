const { MAX_AP } = require('./constants');
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

function createResourcesFromSave(data) {
	const apMax = clampActionPoints(data.resources?.ap?.max ?? 4);
	return {
		hp: {
			current: data.resources?.hp?.current ?? 100,
			max: data.resources?.hp?.max ?? 100,
		},
		ar: {
			current: data.resources?.ar?.current ?? 0,
			max: data.resources?.ar?.max ?? 0,
		},
		ap: {
			current: Math.min(clampActionPoints(data.resources?.ap?.current ?? 4), apMax),
			max: apMax,
		},
		md: {
			current: data.resources?.md?.current ?? 5,
			max: data.resources?.md?.max ?? 5,
		},
	};
}

function restoreResource(character, resourceName, percentage) {
	const resource = resourceName.toLowerCase();
	if (!['hp', 'ar'].includes(resource)) {
		throw characterEditError('Only HP and AR can be restored with the heal command.');
	}
	if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
		throw characterEditError('The rest percentage must be between 0 and 100.');
	}
	const target = character.resources[resource];
	target.current = Math.round(target.max * percentage / 100);
	return target;
}

function resetTurnResources(character) {
	character.resources.ap.current = character.resources.ap.max;
	character.resources.md.current = character.resources.md.max;
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
	clampActionPoints,
	createGeneratedResources,
	createResourcesFromSave,
	resetTurnResources,
	restoreResource,
};

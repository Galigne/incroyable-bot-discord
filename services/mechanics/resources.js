const { MAX_AP } = require('./constants');
const { characterEditError } = require('./characterValidation');
const { calculateArmorRating } = require('./armor');
const { t } = require('../../util/i18n');
const { getResourceAbbreviation } = require('../../util/characterDisplay');

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

function calculateRestoredResourceValue(maximum, percentage, locale = 'en') {
	validateRestorationPercentage(percentage, locale);
	return Math.min(maximum, Math.round(maximum * percentage / 100));
}

function restoreResource(character, resourceName, percentage, locale = 'en') {
	const resource = resourceName.toLowerCase();
	if (!['hp', 'ar'].includes(resource)) {
		throw characterEditError(t(locale, 'errors.healResourcesOnly', resourceLabels(locale)));
	}
	const target = character.resources[resource];
	target.current = calculateRestoredResourceValue(target.max, percentage, locale);
	return target;
}

function restoreHealingResources(character, resourceName, percentage, locale = 'en') {
	const resourceKeys = {
		hp: ['hp'],
		armor: ['ar'],
		both: ['hp', 'ar'],
	}[resourceName];
	if (!resourceKeys) {
		throw characterEditError(t(locale, 'errors.healResourceInvalid', resourceLabels(locale)));
	}
	validateRestorationPercentage(percentage, locale);

	return resourceKeys.map(resource => {
		const target = character.resources[resource];
		const previous = target.current;
		restoreResource(character, resource, percentage, locale);
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

function validateRestorationPercentage(percentage, locale = 'en') {
	if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
		throw characterEditError(t(locale, 'errors.percentageInvalid'));
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

function resourceLabels(locale) {
	return {
		arLabel: getResourceAbbreviation(locale, 'ar'),
		hpLabel: getResourceAbbreviation(locale, 'hp'),
	};
}

module.exports = {
	calculateMaxAp,
	calculateMaxHp,
	calculateMaxMovementDistance,
	calculateRestoredResourceValue,
	clampActionPoints,
	createGeneratedResources,
	createResourcesFromSave,
	resetTurnResources,
	restoreHealingResources,
	restoreResource,
};

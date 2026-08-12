const { t } = require('./i18n');
const { clampActionPoints } = require('../services/mechanics/resources');

// Abbreviation convention:
// English preserves the established internal-facing UI terms HP/AR/AP/MD.
// French follows JDR_RANDOM_RULES_FR.md: PV/PR/PA/DD. Each resource has a
// distinct abbreviation; identifiers and persisted paths remain English.
const RESOURCE_IDS = ['hp', 'ar', 'ap', 'md'];
const PROGRESS_RESOURCE_ICONS = {
	hp: ['❤️', '🖤'],
	ar: ['🟦', '⬛'],
	md: ['🟧', '⬛'],
};

function getResourceName(locale, resourceId) {
	return t(locale, `character.resources.${resourceId}.name`);
}

function getResourceAbbreviation(locale, resourceId) {
	return t(locale, `character.resources.${resourceId}.abbreviation`);
}

function getResourceChoiceLabel(locale, resourceId) {
	return `${getResourceAbbreviation(locale, resourceId)} — ${getResourceName(locale, resourceId)}`;
}

function formatCombatantResource(combatant, resourceId, locale = 'en') {
	if (resourceId === 'ap') {
		return formatActionPoints(combatant.resources.ap, locale);
	}
	const icons = PROGRESS_RESOURCE_ICONS[resourceId];
	if (!icons) {
		throw new RangeError(`Unsupported visual resource: ${resourceId}`);
	}
	return formatProgressResource(
		getResourceAbbreviation(locale, resourceId),
		combatant.resources[resourceId],
		icons[0],
		icons[1],
	);
}

function formatCombatantResources(combatant, resourceIds, locale = 'en') {
	return resourceIds
		.map(resourceId => formatCombatantResource(combatant, resourceId, locale))
		.join('\n');
}

function formatProgressResource(label, resource, filledIcon, emptyIcon) {
	const percentage = getResourcePercentage(resource);
	const filledCount = Math.round(percentage / 10);
	const bar = filledIcon.repeat(filledCount) + emptyIcon.repeat(10 - filledCount);
	return `${label}: **${resource.current} / ${resource.max} (${percentage}%)**\n${bar}`;
}

function formatActionPoints(resource, locale) {
	const maxAp = clampActionPoints(resource.max);
	const availableAp = Math.min(clampActionPoints(resource.current), maxAp);
	const spentAp = maxAp - availableAp;
	return `${getResourceAbbreviation(locale, 'ap')}:\n`
		+ `${'🌟'.repeat(availableAp)}`
		+ `${'⭐'.repeat(spentAp) || (maxAp === 0 ? t(locale, 'common.empty') : '')}`;
}

function getResourcePercentage(resource) {
	if (resource.max <= 0) {
		return 0;
	}
	return Math.max(0, Math.min(100, Math.round(resource.current / resource.max * 100)));
}

module.exports = {
	RESOURCE_IDS,
	formatCombatantResource,
	formatCombatantResources,
	getResourceAbbreviation,
	getResourceChoiceLabel,
	getResourceName,
};

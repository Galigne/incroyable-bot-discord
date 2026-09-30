const { BASE_STATS } = require('../services/mechanics/constants');
const {
	formatCombatantResource,
	formatCombatantResources,
} = require('./combatantDisplay');
const { formatDescribedRecords } = require('./describedRecordDisplay');
const {
	formatRuleList,
	formatStatistics,
	formatSummaryList,
	getStoredValue,
} = require('./entityRendererPrimitives');

const SUMMARY_RESOURCE_IDS = ['hp', 'ar', 'ap', 'md'];
const STATUS_IDS = ['effects', 'modifiers'];

function formatCombatantSummaryStatus(combatant, getLabel, locale = 'en') {
	let result = formatCombatantResources(combatant, SUMMARY_RESOURCE_IDS, locale);
	const sections = STATUS_IDS.map(statusId => ({
		heading: `\n\n**${getLabel(`status.${statusId}`)}**\n`,
		blocks: (combatant.status[statusId] ?? []).map(record => formatDescribedRecords([record], Infinity, locale)),
	})).filter(section => section.blocks.length > 0);
	for (const [index, section] of sections.entries()) {
		// Reserve each later collection's heading and omission count before filling this one.
		const reserved = sections.slice(index + 1).reduce((length, later) =>
			length + later.heading.length + `... (+${later.blocks.length})`.length, 0);
		const budget = 1_024 - result.length - section.heading.length - reserved;
		result += section.heading + formatSummaryList(section.blocks, budget);
	}
	return result;
}

function formatCombatantSummaryStatistics(combatant, getLabel) {
	return BASE_STATS
		.map(stat => `${getLabel(`statistics.${stat}`)}: **${combatant.statistics[stat]}**`)
		.join('\n');
}

function formatCombatantSummaryRules(rules, formatRule, formatList, maxLength, locale) {
	return formatList(rules.map(formatRule), maxLength, locale);
}

function formatCombatantResourceFields(combatant, targets, getLabel, locale = 'en') {
	return targets.map(target => ({
		name: getLabel(target.id),
		value: formatCombatantResource(combatant, target.resourceId, locale),
	}));
}

function formatCombatantStatusFields(combatant, targets, getLabel, locale = 'en') {
	return targets
		.filter(target => (getStoredValue(combatant, target) ?? []).length > 0)
		.map(target => ({
			name: getLabel(target.id),
			value: formatDescribedRecords(
				getStoredValue(combatant, target),
				1_024,
				locale,
			),
		}));
}

function formatCombatantStatisticsFields(combatant, targets, getLabel) {
	return [
		{
			name: getLabel('statistics'),
			value: formatStatistics(
				combatant,
				targets,
				target => getLabel(target.id),
			),
		},
	];
}

function formatCombatantRuleDetails(rules, formatRule, renderBlocks) {
	return formatRuleList(rules, formatRule, renderBlocks);
}

function formatCombatantGearFields(
	combatant,
	targets,
	getLabel,
	getDefinition,
	{
		locale = 'en',
		formatList,
		includeEncumbranceLabel = false,
		inlineEncumbrance = true,
	} = {},
) {
	const encumbranceDefinition = targets.at(-1);
	const encumbrance = getPairValue(
		combatant,
		encumbranceDefinition,
		getDefinition,
	);
	const encumbranceLabel = getLabel(encumbranceDefinition.id);
	const formattedEncumbrance = `**${encumbrance.current} / ${encumbrance.max}**`;
	return [
		...targets.filter(target => target.multiline).map(target => ({
			name: getLabel(target.id),
			value: formatList(getStoredValue(combatant, target), 1_024, locale),
		})),
		{
			name: encumbranceLabel,
			value: includeEncumbranceLabel
				? `${encumbranceLabel}: ${formattedEncumbrance}`
				: formattedEncumbrance,
			...(inlineEncumbrance ? { inline: true } : {}),
		},
	];
}

function getPairValue(entity, definition, getDefinition) {
	const [current, maximum] = definition.inputTargetIds
		.map(getDefinition)
		.map(target => getStoredValue(entity, target));
	return { current, max: maximum };
}

module.exports = {
	formatCombatantGearFields,
	formatCombatantResourceFields,
	formatCombatantRuleDetails,
	formatCombatantStatisticsFields,
	formatCombatantStatusFields,
	formatCombatantSummaryRules,
	formatCombatantSummaryStatistics,
	formatCombatantSummaryStatus,
};

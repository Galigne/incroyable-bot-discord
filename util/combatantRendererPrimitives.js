const { BASE_STATS } = require('../services/mechanics/constants');
const {
	formatCombatantResource,
	formatCombatantResources,
} = require('./combatantDisplay');
const { formatDescribedRecords } = require('./describedRecordDisplay');
const {
	formatRuleList,
	formatStatistics,
	getStoredValue,
} = require('./entityRendererPrimitives');

const SUMMARY_RESOURCE_IDS = ['hp', 'ar', 'ap', 'md'];
const STATUS_IDS = ['effects', 'modifiers'];

function formatCombatantSummaryStatus(combatant, getLabel, locale = 'en') {
	const sections = [
		formatCombatantResources(combatant, SUMMARY_RESOURCE_IDS, locale),
	];
	for (const statusId of STATUS_IDS) {
		const records = combatant.status[statusId] ?? [];
		if (records.length > 0) {
			sections.push(
				`**${getLabel(`status.${statusId}`)}**\n`
					+ formatDescribedRecords(records, 1_024, locale),
			);
		}
	}
	return sections.join('\n\n');
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
			name: getLabel('statistics.base'),
			value: formatStatistics(
				combatant,
				targets.slice(0, BASE_STATS.length),
				target => getLabel(target.id),
			),
			inline: true,
		},
		{
			name: getLabel('statistics.derived'),
			value: formatStatistics(
				combatant,
				targets.slice(BASE_STATS.length),
				target => getLabel(target.id),
			),
			inline: true,
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

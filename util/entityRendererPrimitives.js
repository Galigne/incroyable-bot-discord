const { t } = require('./i18n');

function formatBlockList(blocks, separator, maxLength, locale = 'en') {
	if (blocks.length === 0) {
		return t(locale, 'common.empty');
	}
	return truncateBlocks(blocks, separator, maxLength);
}

function formatJoinedList(blocks, maxLength, locale = 'en') {
	if (blocks.length === 0) {
		return t(locale, 'common.empty');
	}
	const result = blocks.join('\n');
	return result.length <= maxLength
		? result
		: `${result.slice(0, maxLength - 3)}...`;
}

function formatNumberedBlockList(items, maxLength = 1_024, locale = 'en') {
	return formatBlockList(
		items.map((item, index) => `${index + 1}. ${item}`),
		'\n',
		maxLength,
		locale,
	);
}

function formatNumberedJoinedList(items, maxLength, locale = 'en') {
	return formatJoinedList(
		items.map((item, index) => `${index + 1}. ${item}`),
		maxLength,
		locale,
	);
}

function formatRuleList(rules, formatRule, renderBlocks) {
	return renderBlocks(rules.map(formatRule));
}

function formatStatistics(entity, targets, getLabel) {
	return targets.map(target => (
		`${getLabel(target)}: **${getStoredValue(entity, target)}**`
	)).join('\n');
}

function getStoredValue(entity, definition) {
	return definition.path.reduce((value, key) => value[key], entity);
}

function truncate(value, maxLength = 1_024) {
	if (value.length <= maxLength) {
		return value;
	}
	return `${value.slice(0, maxLength - 1)}…`;
}

function truncateBlocks(blocks, separator, maxLength) {
	const included = [];
	for (const block of blocks) {
		const prefixLength = included.length === 0 ? 0 : separator.length;
		const remaining = maxLength - included.join(separator).length - prefixLength;
		if (block.length <= remaining) {
			included.push(block);
			continue;
		}
		if (included.length === 0) {
			included.push(truncate(block, maxLength));
		}
		else {
			const current = included.join(separator);
			if (current.length + separator.length + 1 <= maxLength) {
				included.push('...');
			}
		}
		break;
	}
	return included.join(separator);
}

module.exports = {
	formatBlockList,
	formatJoinedList,
	formatNumberedBlockList,
	formatNumberedJoinedList,
	formatRuleList,
	formatStatistics,
	getStoredValue,
	truncate,
};

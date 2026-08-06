const { t } = require('./i18n');

function formatDescribedRecords(records, maxLength, locale) {
	if (!records.length) {
		return t(locale, 'common.empty');
	}
	const result = records.map(record => (
		`**${record.name}** - ${record.description}`
	)).join('\n');
	return result.length <= maxLength
		? result
		: `${result.slice(0, maxLength - 3)}...`;
}

module.exports = { formatDescribedRecords };

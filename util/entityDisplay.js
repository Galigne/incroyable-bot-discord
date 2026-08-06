const { getEntityFieldDefinition } = require('../services/entityFieldCatalog');
const { getCharacterFieldLabel, getResourceAbbreviation } = require(
	'./characterDisplay',
);
const { t } = require('./i18n');

function getEntityFieldLabel(locale, type, fieldId, options = {}) {
	if (type !== 'creature') {
		return getCharacterFieldLabel(locale, fieldId, options);
	}
	const definition = getEntityFieldDefinition(type, fieldId);
	if (!definition) {
		return null;
	}
	if (options.abbreviated && definition.abbreviationKey) {
		return t(locale, definition.abbreviationKey);
	}
	if (definition.resourceId && !definition.abbreviationKey) {
		return t(locale, definition.labelKey, {
			resource: getResourceAbbreviation(locale, definition.resourceId),
		});
	}
	return t(locale, definition.labelKey);
}

module.exports = { getEntityFieldLabel };

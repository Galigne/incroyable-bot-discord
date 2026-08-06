const { getEntityFieldDefinition } = require('../services/entityFieldCatalog');
const { getCharacterFieldLabel } = require('./characterDisplay');
const { getResourceAbbreviation } = require('./combatantDisplay');
const { t } = require('./i18n');
const { assertEntityType } = require('../services/entityType');

function getEntityFieldLabel(locale, type, fieldId, options = {}) {
	assertEntityType(type);
	if (type === 'character') {
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

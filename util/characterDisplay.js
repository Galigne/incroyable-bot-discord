const { t } = require('./i18n');
const {
	CHARACTER_FIELD_DEFINITIONS,
	getCharacterFieldDefinition,
} = require('../services/characterFieldCatalog');
const { getResourceAbbreviation } = require('./combatantDisplay');

const CHARACTER_DISPLAY_FIELDS = Object.fromEntries(
	CHARACTER_FIELD_DEFINITIONS.map(definition => [definition.id, definition]),
);
const CHARACTER_FIELD_ALIASES = Object.fromEntries(
	CHARACTER_FIELD_DEFINITIONS.flatMap(definition => (
		(definition.aliases ?? []).map(alias => [alias, definition.id])
	)),
);

function resolveCharacterFieldId(fieldId) {
	return getCharacterFieldDefinition(fieldId)?.id ?? fieldId;
}

function getCharacterFieldLabel(locale, fieldId, options = {}) {
	const definition = getCharacterFieldDefinition(fieldId);
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

module.exports = {
	CHARACTER_DISPLAY_FIELDS,
	CHARACTER_FIELD_ALIASES,
	getCharacterFieldDefinition,
	getCharacterFieldLabel,
	resolveCharacterFieldId,
};

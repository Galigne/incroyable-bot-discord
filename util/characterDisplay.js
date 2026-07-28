const { t } = require('./i18n');
const {
	CHARACTER_FIELD_DEFINITIONS,
	getCharacterFieldDefinition,
} = require('../services/characterFieldCatalog');

// Abbreviation convention:
// English preserves the established internal-facing UI terms HP/AR/AP/MD.
// French follows JDR_RANDOM_RULES_FR.md: PV/PR/PA/DD. Each resource has a
// distinct abbreviation; identifiers and persisted paths remain English.
const RESOURCE_IDS = ['hp', 'ar', 'ap', 'md'];

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

function getResourceName(locale, resourceId) {
	return t(locale, `character.resources.${resourceId}.name`);
}

function getResourceAbbreviation(locale, resourceId) {
	return t(locale, `character.resources.${resourceId}.abbreviation`);
}

function getResourceChoiceLabel(locale, resourceId) {
	return `${getResourceAbbreviation(locale, resourceId)} — ${getResourceName(locale, resourceId)}`;
}

module.exports = {
	CHARACTER_DISPLAY_FIELDS,
	CHARACTER_FIELD_ALIASES,
	RESOURCE_IDS,
	getCharacterFieldDefinition,
	getCharacterFieldLabel,
	getResourceAbbreviation,
	getResourceChoiceLabel,
	getResourceName,
	resolveCharacterFieldId,
};

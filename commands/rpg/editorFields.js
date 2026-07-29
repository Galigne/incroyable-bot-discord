const { getCharacterFieldLabel } = require('../../util/characterDisplay');
const {
	getCharacterFieldDefinition,
	getEditableFieldDefinition,
	getEditableFields,
} = require('../../services/characterFieldCatalog');

const editableFields = getEditableFields();
const EDIT_FIELDS = editableFields.map(definition => definition.editId);

function getEditFieldLabel(fieldName, locale = 'en') {
	const definition = getEditableFieldDefinition(fieldName);
	return getCharacterFieldLabel(locale, definition?.id ?? fieldName);
}

function getEditTargetDefinitions(fieldName) {
	const definition = getEditableFieldDefinition(fieldName);
	return definition?.editTargetIds.map(getCharacterFieldDefinition) ?? [];
}

function getEditInputId(fieldId) {
	return `field-${fieldId
		.replace(/([a-z])([A-Z])/g, '$1-$2')
		.replaceAll('.', '-')
		.toLowerCase()}`;
}

function getEditFormat(fieldName, locale = 'en') {
	return getEditTargetDefinitions(fieldName)
		.map(definition => getCharacterFieldLabel(locale, definition.id))
		.join(':');
}

module.exports = {
	EDIT_FIELDS,
	getEditFieldLabel,
	getEditFormat,
	getEditInputId,
	getEditTargetDefinitions,
};

const { getCharacterFieldLabel } = require('../../util/characterDisplay');
const {
	getEditableFieldDefinition,
	getEditableFields,
} = require('../../services/characterFieldCatalog');

const editableFields = getEditableFields();
const EDIT_FIELDS = editableFields.map(definition => definition.editId);
const MULTILINE_COLLECTION_FIELDS = new Set(editableFields
	.filter(definition => definition.multiline)
	.map(definition => definition.editId.toLowerCase()));
const PARAGRAPH_FIELDS = new Set(editableFields
	.filter(definition => definition.paragraph)
	.map(definition => definition.editId.toLowerCase()));

function getEditFieldLabel(fieldName, locale = 'en') {
	const definition = getEditableFieldDefinition(fieldName);
	return getCharacterFieldLabel(locale, definition?.id ?? fieldName);
}

module.exports = {
	EDIT_FIELDS,
	getEditFieldLabel,
	MULTILINE_COLLECTION_FIELDS,
	PARAGRAPH_FIELDS,
};

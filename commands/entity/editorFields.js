const {
	getEditableEntityFieldDefinition,
	getEntityFieldDefinition,
} = require('../../services/entityFieldCatalog');
const { getEntityFieldLabel } = require('../../util/entityDisplay');

function getEntityEditFieldLabel(type, fieldName, locale = 'en') {
	const definition = getEditableEntityFieldDefinition(type, fieldName);
	return getEntityFieldLabel(locale, type, definition?.id ?? fieldName);
}

function getEntityEditTargetDefinitions(type, fieldName) {
	const definition = getEditableEntityFieldDefinition(type, fieldName);
	return definition?.editInputIds.map(inputId => (
		getEntityFieldDefinition(type, inputId)
	)) ?? [];
}

function getEntityEditInputId(fieldId) {
	return `field-${fieldId
		.replace(/([a-z])([A-Z])/g, '$1-$2')
		.replaceAll('.', '-')
		.toLowerCase()}`;
}

module.exports = {
	getEntityEditFieldLabel,
	getEntityEditInputId,
	getEntityEditTargetDefinitions,
};

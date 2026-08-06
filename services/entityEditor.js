const characterEditor = require('./characterEditor');
const creatureEditor = require('./creatureEditor');

function getEditor(type) {
	return type === 'creature' ? creatureEditor : characterEditor;
}

function getEditableEntityFieldValue(entity, fieldName) {
	return getEditor(entity.type).getEditableFieldValue(entity, fieldName);
}

function setEditableEntityFieldValue(entity, fieldName, value) {
	return getEditor(entity.type).setEditableFieldValue(entity, fieldName, value);
}

module.exports = {
	getEditableEntityFieldValue,
	setEditableEntityFieldValue,
};

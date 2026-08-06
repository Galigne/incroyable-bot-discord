const characterCatalog = require('./characterFieldCatalog');
const creatureCatalog = require('./creatureFieldCatalog');
const { assertEntityType } = require('./entityType');

function getEntityFieldDefinition(type, fieldId) {
	assertEntityType(type);
	return type === 'creature'
		? creatureCatalog.getCreatureFieldDefinition(fieldId)
		: characterCatalog.getCharacterFieldDefinition(fieldId);
}

function getEditableEntityFieldDefinition(type, fieldId) {
	assertEntityType(type);
	return type === 'creature'
		? creatureCatalog.getEditableCreatureFieldDefinition(fieldId)
		: characterCatalog.getEditableFieldDefinition(fieldId);
}

function getViewableEntityFieldDefinition(type, fieldId) {
	assertEntityType(type);
	return type === 'creature'
		? creatureCatalog.getViewableCreatureFieldDefinition(fieldId)
		: characterCatalog.getViewableFieldDefinition(fieldId);
}

function getEntitySections(type) {
	assertEntityType(type);
	return type === 'creature'
		? creatureCatalog.getCreatureSections()
		: characterCatalog.getCharacterSections();
}

function getAllEntitySections() {
	return {
		character: characterCatalog.getCharacterSections(),
		creature: creatureCatalog.getCreatureSections(),
	};
}

module.exports = {
	getAllEntitySections,
	getEditableEntityFieldDefinition,
	getEntityFieldDefinition,
	getEntitySections,
	getViewableEntityFieldDefinition,
};

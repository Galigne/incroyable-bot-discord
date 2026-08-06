const characterCatalog = require('./characterFieldCatalog');
const creatureCatalog = require('./creatureFieldCatalog');

function getEntityFieldDefinition(type, fieldId) {
	return type === 'creature'
		? creatureCatalog.getCreatureFieldDefinition(fieldId)
		: characterCatalog.getCharacterFieldDefinition(fieldId);
}

function getEditableEntityFieldDefinition(type, fieldId) {
	return type === 'creature'
		? creatureCatalog.getEditableCreatureFieldDefinition(fieldId)
		: characterCatalog.getEditableFieldDefinition(fieldId);
}

function getViewableEntityFieldDefinition(type, fieldId) {
	return type === 'creature'
		? creatureCatalog.getViewableCreatureFieldDefinition(fieldId)
		: characterCatalog.getViewableFieldDefinition(fieldId);
}

function getEntitySections(type) {
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

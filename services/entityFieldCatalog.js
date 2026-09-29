const characterCatalog = require('./characterFieldCatalog');
const creatureCatalog = require('./creatureFieldCatalog');
const { assertEntityType } = require('./entityType');

const SETTINGS_FIELD_DEFINITION = Object.freeze({
	id: 'settings',
	labelKey: 'entity.settings.fields.settings',
	editId: 'settings',
	editInputIds: Object.freeze([
		'settings.key',
		'settings.visibility',
		'settings.access',
	]),
	editKind: 'multi',
});
const SETTINGS_INPUT_DEFINITIONS = new Map([
	['settings.key', Object.freeze({
		id: 'settings.key',
		labelKey: 'entity.settings.fields.key',
		maxLength: 50,
		required: true,
		type: 'text',
	})],
	['settings.visibility', Object.freeze({
		id: 'settings.visibility',
		labelKey: 'entity.settings.fields.visibility',
		maxLength: 7,
		required: true,
		type: 'text',
	})],
	['settings.access', Object.freeze({
		id: 'settings.access',
		labelKey: 'entity.settings.fields.access',
		maxLength: 4_000,
		multiline: true,
		paragraph: true,
		type: 'text',
	})],
]);

function getEntityFieldDefinition(type, fieldId) {
	assertEntityType(type);
	if (fieldId === 'settings') {
		return SETTINGS_FIELD_DEFINITION;
	}
	if (SETTINGS_INPUT_DEFINITIONS.has(fieldId)) {
		return SETTINGS_INPUT_DEFINITIONS.get(fieldId);
	}
	return type === 'creature'
		? creatureCatalog.getCreatureFieldDefinition(fieldId)
		: characterCatalog.getCharacterFieldDefinition(fieldId);
}

function getEditableEntityFieldDefinition(type, fieldId) {
	assertEntityType(type);
	if (fieldId === 'settings') {
		return SETTINGS_FIELD_DEFINITION;
	}
	return type === 'creature'
		? creatureCatalog.getEditableCreatureFieldDefinition(fieldId)
		: characterCatalog.getEditableFieldDefinition(fieldId);
}

function getEditableEntityFields(type) {
	assertEntityType(type);
	const fields = type === 'creature'
		? creatureCatalog.getEditableCreatureFields()
		: characterCatalog.getEditableFields();
	return Object.freeze([...fields, SETTINGS_FIELD_DEFINITION]);
}

function getViewableEntityFieldDefinition(type, fieldId) {
	assertEntityType(type);
	return type === 'creature'
		? creatureCatalog.getViewableCreatureFieldDefinition(fieldId)
		: characterCatalog.getViewableFieldDefinition(fieldId);
}

function getViewableEntityFields(type) {
	assertEntityType(type);
	return type === 'creature'
		? creatureCatalog.getViewableCreatureFields()
		: characterCatalog.getViewableFields();
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

function getAllEditableEntityFields() {
	return {
		character: getEditableEntityFields('character'),
		creature: getEditableEntityFields('creature'),
	};
}

module.exports = {
	getAllEditableEntityFields,
	getAllEntitySections,
	getEditableEntityFieldDefinition,
	getEditableEntityFields,
	getEntityFieldDefinition,
	getEntitySections,
	getViewableEntityFieldDefinition,
	getViewableEntityFields,
};

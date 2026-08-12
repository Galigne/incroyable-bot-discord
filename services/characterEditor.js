const { createFieldEditor } = require('./entityFieldEditor');
const {
	getCharacterFieldDefinition,
	getEditableFieldDefinition,
} = require('./characterFieldCatalog');
const {
	characterEditError,
	validateActionPointPair,
} = require('./mechanics/characterValidation');

const editor = createFieldEditor({
	createEditError: characterEditError,
	getEditableFieldDefinition,
	getFieldDefinition: getCharacterFieldDefinition,
	validateUpdates: validateCharacterUpdates,
});

function validateCharacterUpdates(character, updates) {
	const actionPointUpdates = updates.filter(update => (
		update.target.path[0] === 'resources'
		&& update.target.path[1] === 'ap'
	));
	if (actionPointUpdates.length === 0) {
		return;
	}
	const proposed = {
		...character.resources.ap,
		...Object.fromEntries(actionPointUpdates.map(update => [
			update.target.path[2],
			update.value,
		])),
	};
	validateActionPointPair(proposed.current, proposed.max);
}

module.exports = editor;

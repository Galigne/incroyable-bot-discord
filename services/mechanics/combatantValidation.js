const { assertEntityType } = require('../entityType');

function combatantEditError(combatant, translationKey, translationVariables = {}) {
	assertEntityType(combatant?.type);
	const error = new Error(translationKey);
	error.code = combatant?.type === 'creature'
		? 'INVALID_CREATURE_EDIT'
		: 'INVALID_CHARACTER_EDIT';
	error.translationKey = translationKey;
	error.translationVariables = translationVariables;
	return error;
}

module.exports = { combatantEditError };

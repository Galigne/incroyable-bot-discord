function combatantEditError(combatant, translationKey, translationVariables = {}) {
	const error = new Error(translationKey);
	error.code = combatant?.type === 'creature'
		? 'INVALID_CREATURE_EDIT'
		: 'INVALID_CHARACTER_EDIT';
	error.translationKey = translationKey;
	error.translationVariables = translationVariables;
	return error;
}

module.exports = { combatantEditError };

const { MAX_AP } = require('./constants');

function characterEditError(translationKey, translationVariables = {}) {
	const error = new Error(translationKey);
	error.code = 'INVALID_CHARACTER_EDIT';
	error.translationKey = translationKey;
	error.translationVariables = translationVariables;
	return error;
}

function validateActionPointEdit(character, path, value) {
	if (
		path[0] !== 'resources'
		|| path[1] !== 'ap'
	) {
		return;
	}
	if (!Number.isInteger(value) || value < 0 || value > MAX_AP) {
		throw characterEditError('errors.apRange', {
			max: MAX_AP,
		});
	}
	if (path[2] === 'current' && value > character.resources.ap.max) {
		throw characterEditError('errors.apCurrentAboveMax');
	}
	if (path[2] === 'max' && value < character.resources.ap.current) {
		throw characterEditError('errors.apMaxBelowCurrent');
	}
}

function validateActionPointPair(current, maximum) {
	if (
		!Number.isInteger(current)
		|| !Number.isInteger(maximum)
		|| current < 0
		|| maximum < 0
		|| current > MAX_AP
		|| maximum > MAX_AP
	) {
		throw characterEditError('errors.apRange', {
			max: MAX_AP,
		});
	}
	if (current > maximum) {
		throw characterEditError('errors.apCurrentAboveMax');
	}
}

module.exports = {
	characterEditError,
	validateActionPointEdit,
	validateActionPointPair,
};

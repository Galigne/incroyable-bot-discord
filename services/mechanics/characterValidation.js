const { MAX_AP } = require('./constants');

function characterEditError(translationKey, translationVariables = {}) {
	const error = new Error(translationKey);
	error.code = 'INVALID_CHARACTER_EDIT';
	error.translationKey = translationKey;
	error.translationVariables = translationVariables;
	return error;
}

function combatantEditError(combatant, translationKey, translationVariables = {}) {
	const error = characterEditError(translationKey, translationVariables);
	if (combatant?.type === 'creature') {
		error.code = 'INVALID_CREATURE_EDIT';
	}
	return error;
}

function validateActionPointEdit(character, path, value) {
	if (
		path[0] !== 'status'
		|| path[1] !== 'ap'
	) {
		return;
	}
	if (!Number.isInteger(value) || value < 0 || value > MAX_AP) {
		throw characterEditError('errors.apRange', {
			max: MAX_AP,
		});
	}
	if (path[2] === 'current' && value > character.status.ap.max) {
		throw characterEditError('errors.apCurrentAboveMax');
	}
	if (path[2] === 'max' && value < character.status.ap.current) {
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

function copyStringList(value) {
	return Array.isArray(value) ? value.filter(item => typeof item === 'string') : [];
}

function copyTalentList(value) {
	if (Array.isArray(value)) {
		return copyStringList(value);
	}
	if (typeof value !== 'string') {
		return [];
	}
	return value
		.split(/\r?\n/)
		.map(line => line.trim().replace(/^[-*]\s+/, ''))
		.filter(Boolean);
}

function copyRules(value) {
	if (!Array.isArray(value)) {
		return [];
	}
	return value
		.filter(rule => rule && typeof rule.name === 'string')
		.map(rule => ({
			name: rule.name,
			description: typeof rule.description === 'string' ? rule.description : '',
			level: Number.isInteger(rule.level) && rule.level > 0 ? rule.level : 1,
		}));
}

module.exports = {
	characterEditError,
	combatantEditError,
	copyRules,
	copyStringList,
	copyTalentList,
	validateActionPointEdit,
	validateActionPointPair,
};

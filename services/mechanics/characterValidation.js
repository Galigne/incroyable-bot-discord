const { MAX_AP } = require('./constants');

function characterEditError(message) {
	const error = new Error(message);
	error.code = 'INVALID_CHARACTER_EDIT';
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
		throw characterEditError(`AP must be a whole number between 0 and ${MAX_AP}.`);
	}
	if (path[2] === 'current' && value > character.resources.ap.max) {
		throw characterEditError('Current AP cannot be greater than maximum AP.');
	}
	if (path[2] === 'max' && value < character.resources.ap.current) {
		throw characterEditError('Maximum AP cannot be lower than current AP.');
	}
}

function copyStringList(value) {
	return Array.isArray(value) ? value.filter(item => typeof item === 'string') : [];
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
	copyRules,
	copyStringList,
	validateActionPointEdit,
};

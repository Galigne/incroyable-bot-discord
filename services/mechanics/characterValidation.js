const { MAX_AP } = require('./constants');
const { t } = require('../../util/i18n');
const { getResourceAbbreviation } = require('../../util/characterDisplay');

function characterEditError(message) {
	const error = new Error(message);
	error.code = 'INVALID_CHARACTER_EDIT';
	return error;
}

function validateActionPointEdit(character, path, value, locale = 'en') {
	if (
		path[0] !== 'resources'
		|| path[1] !== 'ap'
	) {
		return;
	}
	if (!Number.isInteger(value) || value < 0 || value > MAX_AP) {
		throw characterEditError(t(locale, 'errors.apRange', {
			apLabel: getResourceAbbreviation(locale, 'ap'),
			max: MAX_AP,
		}));
	}
	if (path[2] === 'current' && value > character.resources.ap.max) {
		throw characterEditError(t(locale, 'errors.apCurrentAboveMax', {
			apLabel: getResourceAbbreviation(locale, 'ap'),
		}));
	}
	if (path[2] === 'max' && value < character.resources.ap.current) {
		throw characterEditError(t(locale, 'errors.apMaxBelowCurrent', {
			apLabel: getResourceAbbreviation(locale, 'ap'),
		}));
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

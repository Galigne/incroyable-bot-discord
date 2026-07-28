const BASE_STATS = Object.freeze([
	'constitution',
	'strength',
	'dexterity',
	'intelligence',
	'speed',
	'perception',
	'charisma',
]);
const DERIVED_STATS = Object.freeze(['initiative', 'reflexes']);
const MAX_AP = 10;

module.exports = {
	BASE_STATS,
	DERIVED_STATS,
	MAX_AP,
};

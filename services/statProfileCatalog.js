const fs = require('node:fs');
const path = require('node:path');
const { BASE_STATS } = require('./mechanics/constants');

const STAT_PROFILE_SCHEMA_VERSION = 1;
const STAT_PROFILE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const statProfilePath = path.join(
	__dirname,
	'..',
	'data',
	'generators',
	'stat-profile.json',
);
let cachedProfiles = null;

function getStatProfile(profileId) {
	return loadStatProfiles().get(profileId);
}

function listStatProfiles() {
	return [...loadStatProfiles().values()];
}

function clearStatProfileCache() {
	cachedProfiles = null;
}

function reloadStatProfiles() {
	return replaceStatProfiles(createStatProfileCandidate());
}

function createStatProfileCandidate() {
	return readStatProfiles();
}

function replaceStatProfiles(profiles) {
	cachedProfiles = profiles;
	return profiles;
}

function loadStatProfiles() {
	if (!cachedProfiles) {
		cachedProfiles = readStatProfiles();
	}
	return cachedProfiles;
}

function readStatProfiles() {
	let document;
	try {
		document = JSON.parse(fs.readFileSync(statProfilePath, 'utf8'));
	}
	catch (error) {
		throw statProfileError(
			'INVALID_STAT_PROFILE_DOCUMENT',
			`Unable to load statistical profiles: ${error.message}`,
		);
	}
	validateStatProfileDocument(document);
	return new Map(document.profiles.map(profile => [
		profile.id,
		freezeStatProfile(profile),
	]));
}

function validateStatProfileDocument(document) {
	assertPlainObject(document, 'Statistical profiles must be an object.');
	assertExactKeys(
		document,
		['schemaVersion', 'profiles'],
		'Statistical profiles contain unsupported properties.',
	);
	if (document.schemaVersion !== STAT_PROFILE_SCHEMA_VERSION) {
		throw statProfileError(
			'INVALID_STAT_PROFILE_SCHEMA_VERSION',
			`Statistical profiles must use schemaVersion ${STAT_PROFILE_SCHEMA_VERSION}.`,
		);
	}
	if (!Array.isArray(document.profiles) || document.profiles.length === 0) {
		throw statProfileError(
			'INVALID_STAT_PROFILE_DOCUMENT',
			'At least one statistical profile is required.',
		);
	}

	const ids = new Set();
	for (const profile of document.profiles) {
		validateStatProfile(profile);
		if (ids.has(profile.id)) {
			throw statProfileError(
				'DUPLICATE_STAT_PROFILE_ID',
				`Duplicate statistical profile ID: ${profile.id}.`,
			);
		}
		ids.add(profile.id);
	}
	return document;
}

function validateStatProfile(profile) {
	assertPlainObject(profile, 'A statistical profile must be an object.');
	assertExactKeys(
		profile,
		['id', 'minimums', 'maximums', 'weights'],
		'A statistical profile contains unsupported properties.',
	);
	if (
		typeof profile.id !== 'string'
		|| profile.id.length > 100
		|| !STAT_PROFILE_ID_PATTERN.test(profile.id)
	) {
		throw statProfileError(
			'INVALID_STAT_PROFILE_ID',
			'Statistical profiles require stable kebab-case IDs.',
		);
	}
	validateStatisticMap(profile.minimums, 'minimums', value => (
		Number.isInteger(value) && value >= 4 && value <= 20
	));
	validateStatisticMap(profile.maximums, 'maximums', value => (
		Number.isInteger(value) && value >= 4 && value <= 20
	));
	validateStatisticMap(profile.weights, 'weights', value => (
		Number.isFinite(value) && value >= 0
	));

	for (const stat of BASE_STATS) {
		if (profile.minimums[stat] > profile.maximums[stat]) {
			throw statProfileError(
				'INVALID_STAT_PROFILE_BOUNDS',
				`Statistical profile ${profile.id} has reversed ${stat} bounds.`,
			);
		}
	}
	if (!BASE_STATS.some(stat => profile.weights[stat] > 0)) {
		throw statProfileError(
			'INVALID_STAT_PROFILE_WEIGHTS',
			`Statistical profile ${profile.id} needs at least one positive weight.`,
		);
	}
	return profile;
}

function validateStatisticMap(values, property, isValidValue) {
	assertPlainObject(values, `Statistical profile ${property} must be an object.`);
	assertExactKeys(
		values,
		BASE_STATS,
		`Statistical profile ${property} must define exactly the seven base statistics.`,
	);
	if (BASE_STATS.some(stat => !isValidValue(values[stat]))) {
		throw statProfileError(
			'INVALID_STAT_PROFILE_VALUE',
			`Statistical profile ${property} contains an invalid value.`,
		);
	}
}

function freezeStatProfile(profile) {
	return Object.freeze({
		...profile,
		minimums: Object.freeze({ ...profile.minimums }),
		maximums: Object.freeze({ ...profile.maximums }),
		weights: Object.freeze({ ...profile.weights }),
	});
}

function assertPlainObject(value, message) {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw statProfileError('INVALID_STAT_PROFILE_STRUCTURE', message);
	}
}

function assertExactKeys(value, expectedKeys, message) {
	const actualKeys = Object.keys(value);
	if (
		actualKeys.length !== expectedKeys.length
		|| expectedKeys.some(key => !Object.hasOwn(value, key))
	) {
		throw statProfileError('INVALID_STAT_PROFILE_STRUCTURE', message);
	}
}

function statProfileError(code, message) {
	const error = new Error(message);
	error.name = 'StatProfileError';
	error.code = code;
	return error;
}

module.exports = {
	STAT_PROFILE_SCHEMA_VERSION,
	clearStatProfileCache,
	createStatProfileCandidate,
	getStatProfile,
	listStatProfiles,
	reloadStatProfiles,
	replaceStatProfiles,
	validateStatProfile,
	validateStatProfileDocument,
};

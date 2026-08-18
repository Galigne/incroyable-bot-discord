const { BASE_STATS, DERIVED_STATS, MAX_AP } = require('./mechanics/constants');
const { validateEntityKey } = require('./entityStoragePaths');

const CURRENT_CREATURE_SAVE_SCHEMA_VERSION = 4;
const CREATURE_STAT_IDS = Object.freeze([...BASE_STATS, ...DERIVED_STATS]);
const TECHNICAL_ID = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const STAT_PROFILE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validateCreatureSaveSchema(rawSaveData, expectedKey = rawSaveData?.key) {
	if (!isRecord(rawSaveData) || !Object.hasOwn(rawSaveData, 'schemaVersion')) {
		throw schemaError(
			'MISSING_CREATURE_SCHEMA_VERSION',
			'Creature save is missing schemaVersion.',
		);
	}
	if (!Number.isInteger(rawSaveData.schemaVersion) || rawSaveData.schemaVersion < 0) {
		throw schemaError(
			'INVALID_CREATURE_SCHEMA_VERSION',
			'Creature save schemaVersion must be a non-negative integer.',
		);
	}
	if (rawSaveData.schemaVersion !== CURRENT_CREATURE_SAVE_SCHEMA_VERSION) {
		throw schemaError(
			'UNSUPPORTED_CREATURE_SCHEMA_VERSION',
			`Unsupported creature save schemaVersion ${rawSaveData.schemaVersion}.`,
		);
	}
	assertExactKeys(rawSaveData, 'creature save', [
		'schemaVersion',
		'type',
		'key',
		'creatorId',
		'level',
		'name',
		'description',
		'source',
		'statistics',
		'resources',
		'status',
		'traits',
		'rules',
		'gear',
	]);

	try {
		validateEntityKey(rawSaveData.key);
	}
	catch (error) {
		throw schemaError('INVALID_CREATURE_KEY', 'Creature save key is invalid.', error);
	}
	if (rawSaveData.key !== expectedKey) {
		throw schemaError(
			'CREATURE_KEY_MISMATCH',
			'Creature save key does not match its storage key.',
		);
	}
	if (rawSaveData.type !== 'creature') {
		throw schemaError(
			'INVALID_CREATURE_TYPE',
			'Creature save type must be creature.',
		);
	}
	assertNonEmptyString(rawSaveData.creatorId, 'creatorId');
	assertIntegerInRange(rawSaveData.level, 'level', 1, 10);
	assertBoundedString(rawSaveData.name, 'name', 256);
	assertBoundedString(rawSaveData.description, 'description', 4_000);
	validateSource(rawSaveData.source);
	validateStatistics(rawSaveData.statistics);
	validateResources(rawSaveData.resources);
	validateStatus(rawSaveData.status);
	validateNonEmptyStringList(rawSaveData.traits, 'traits');
	validateRules(rawSaveData.rules);
	validateGear(rawSaveData.gear);
	return rawSaveData;
}

function validateSource(source) {
	if (source === null) {
		return;
	}
	assertRecord(source, 'source');
	assertExactKeys(source, 'source', [], [
		'generatorId',
		'entryId',
		'archetypeId',
		'statProfileId',
		'provenance',
	]);
	for (const field of [
		'generatorId',
		'entryId',
		'archetypeId',
		'statProfileId',
	]) {
		if (source[field] !== undefined && source[field] !== null) {
			if (field === 'statProfileId') {
				assertStatProfileId(source[field], `source.${field}`);
			}
			else {
				assertTechnicalId(source[field], `source.${field}`);
			}
		}
	}
	validateProvenance(source.provenance ?? [], 'source.provenance');
}

function validateStatistics(statistics) {
	assertRecord(statistics, 'statistics');
	assertExactKeys(statistics, 'statistics', CREATURE_STAT_IDS);
	for (const statId of CREATURE_STAT_IDS) {
		assertFiniteInRange(statistics[statId], `statistics.${statId}`, 0, 100);
	}
}

function validateStatus(status) {
	assertRecord(status, 'status');
	assertExactKeys(status, 'status', ['effects', 'modifiers']);
	validateDescribedRecords(status.effects, 'status.effects', {
		selectionSource: true,
	});
	validateDescribedRecords(status.modifiers, 'status.modifiers', {
		selectionSource: true,
	});
}

function validateResources(resources) {
	assertRecord(resources, 'resources');
	assertExactKeys(resources, 'resources', ['hp', 'ar', 'ap', 'md']);
	for (const resourceId of ['hp', 'ar', 'ap', 'md']) {
		validateResource(
			resources[resourceId],
			`resources.${resourceId}`,
			resourceId === 'ap',
		);
	}
}

function validateResource(resource, path, actionPoints = false) {
	assertRecord(resource, path);
	assertExactKeys(resource, path, ['current', 'max']);
	const upperBound = actionPoints ? MAX_AP : Number.MAX_SAFE_INTEGER;
	assertFiniteInRange(resource.current, `${path}.current`, 0, upperBound);
	assertFiniteInRange(resource.max, `${path}.max`, 0, upperBound);
	if (resource.current > resource.max) {
		throw invalidSave(`${path}.current cannot exceed ${path}.max.`);
	}
	if (actionPoints && (!Number.isInteger(resource.current) || !Number.isInteger(resource.max))) {
		throw invalidSave(`${path} values must be whole numbers.`);
	}
}

function validateRules(rules) {
	if (!Array.isArray(rules)) {
		throw invalidSave('rules must be an array.');
	}
	for (const [index, rule] of rules.entries()) {
		assertRecord(rule, `rules[${index}]`);
		assertExactKeys(
			rule,
			`rules[${index}]`,
			['name', 'description', 'level'],
			['entryId'],
		);
		assertNonEmptyString(rule.name, `rules[${index}].name`);
		assertNonEmptyString(rule.description, `rules[${index}].description`);
		assertIntegerInRange(
			rule.level,
			`rules[${index}].level`,
			1,
			Number.MAX_SAFE_INTEGER,
		);
		if (rule.entryId !== undefined) {
			assertTechnicalId(rule.entryId, `rules[${index}].entryId`);
		}
	}
}

function validateDescribedRecords(records, path, options = {}) {
	if (!Array.isArray(records)) {
		throw invalidSave(`${path} must be an array.`);
	}
	for (const [index, record] of records.entries()) {
		const recordPath = `${path}[${index}]`;
		assertRecord(record, recordPath);
		const optionalKeys = [];
		if (options.recordId) {
			optionalKeys.push(options.recordId);
		}
		if (options.selectionSource) {
			optionalKeys.push('generatorId', 'entryId', 'provenance');
		}
		assertExactKeys(
			record,
			recordPath,
			['name', 'description'],
			optionalKeys,
		);
		assertNonEmptyString(record.name, `${recordPath}.name`);
		assertNonEmptyString(record.description, `${recordPath}.description`);
		if (options.recordId && record[options.recordId] !== undefined) {
			assertTechnicalId(
				record[options.recordId],
				`${recordPath}.${options.recordId}`,
			);
		}
		if (options.selectionSource) {
			for (const idField of ['generatorId', 'entryId']) {
				if (record[idField] !== undefined) {
					assertTechnicalId(record[idField], `${recordPath}.${idField}`);
				}
			}
			validateProvenance(record.provenance ?? [], `${recordPath}.provenance`);
		}
	}
}

function validateProvenance(provenance, path) {
	if (!Array.isArray(provenance)) {
		throw invalidSave(`${path} must be an array.`);
	}
	for (const [index, record] of provenance.entries()) {
		const recordPath = `${path}[${index}]`;
		assertRecord(record, recordPath);
		assertExactKeys(
			record,
			recordPath,
			['type', 'selection', 'generatorId', 'path'],
			['entryId'],
		);
		assertNonEmptyString(record.type, `${recordPath}.type`);
		assertNonEmptyString(record.selection, `${recordPath}.selection`);
		assertTechnicalId(record.generatorId, `${recordPath}.generatorId`);
		if (record.entryId !== undefined) {
			assertTechnicalId(record.entryId, `${recordPath}.entryId`);
		}
		assertNonEmptyString(record.path, `${recordPath}.path`);
	}
}

function validateGear(gear) {
	assertRecord(gear, 'gear');
	assertExactKeys(gear, 'gear', ['equipment', 'inventory', 'encumbrance']);
	validateStringList(gear.equipment, 'gear.equipment');
	validateStringList(gear.inventory, 'gear.inventory');
	validateResource(gear.encumbrance, 'gear.encumbrance');
}

function validateStringList(value, path) {
	if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
		throw invalidSave(`${path} must be an array of strings.`);
	}
}

function validateNonEmptyStringList(value, path) {
	validateStringList(value, path);
	for (const [index, item] of value.entries()) {
		assertNonEmptyString(item, `${path}[${index}]`);
	}
}

function assertRecord(value, path) {
	if (!isRecord(value)) {
		throw invalidSave(`${path} must be an object.`);
	}
}

function assertExactKeys(value, path, requiredKeys, optionalKeys = []) {
	const allowedKeys = new Set([...requiredKeys, ...optionalKeys]);
	const missingKey = requiredKeys.find(key => !Object.hasOwn(value, key));
	if (missingKey) {
		throw invalidSave(`${path} is missing ${missingKey}.`);
	}
	const unknownKey = Object.keys(value).find(key => !allowedKeys.has(key));
	if (unknownKey) {
		throw invalidSave(`${path} contains unknown property ${unknownKey}.`);
	}
}

function assertString(value, path) {
	if (typeof value !== 'string') {
		throw invalidSave(`${path} must be a string.`);
	}
}

function assertNonEmptyString(value, path) {
	assertString(value, path);
	if (!value.trim()) {
		throw invalidSave(`${path} must not be empty.`);
	}
}

function assertBoundedString(value, path, maximumLength) {
	assertString(value, path);
	if (value.length > maximumLength) {
		throw invalidSave(`${path} must contain at most ${maximumLength} characters.`);
	}
}

function assertTechnicalId(value, path) {
	if (typeof value !== 'string' || !TECHNICAL_ID.test(value)) {
		throw invalidSave(`${path} must be a stable technical ID.`);
	}
}

function assertStatProfileId(value, path) {
	if (typeof value !== 'string' || !STAT_PROFILE_ID.test(value)) {
		throw invalidSave(`${path} must be a stable statistical profile ID.`);
	}
}

function assertIntegerInRange(value, path, minimum, maximum) {
	if (!Number.isInteger(value) || value < minimum || value > maximum) {
		throw invalidSave(`${path} must be an integer from ${minimum} to ${maximum}.`);
	}
}

function assertFiniteInRange(value, path, minimum, maximum) {
	if (!Number.isFinite(value) || value < minimum || value > maximum) {
		throw invalidSave(`${path} must be from ${minimum} to ${maximum}.`);
	}
}

function isRecord(value) {
	return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function invalidSave(message, cause) {
	return schemaError('INVALID_CREATURE_SAVE', message, cause);
}

function schemaError(code, message, cause) {
	const error = new Error(message, cause ? { cause } : undefined);
	error.name = 'CreatureSaveSchemaError';
	error.code = code;
	return error;
}

module.exports = {
	CREATURE_STAT_IDS,
	CURRENT_CREATURE_SAVE_SCHEMA_VERSION,
	validateCreatureSaveSchema,
};

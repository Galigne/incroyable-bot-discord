const { BASE_STATS, DERIVED_STATS, MAX_AP } = require('./mechanics/constants');

const COMBATANT_STAT_IDS = Object.freeze([...BASE_STATS, ...DERIVED_STATS]);
const COMBATANT_RESOURCE_IDS = Object.freeze(['hp', 'ar', 'ap', 'md']);
const TECHNICAL_ID = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const STAT_PROFILE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validateCombatantState(state, createError) {
	assertRecord(state, 'combatant state', createError);
	validateCombatantStatistics(state.statistics, createError);
	validateCombatantResources(state.resources, createError);
	validateCombatantStatus(state.status, createError);
	validateCombatantRules(state.rules, createError);
	validateCombatantGear(state.gear, createError);
}

function validateCombatantLevel(level, createError) {
	assertIntegerInRange(level, 'level', 1, 10, createError);
}

function validateCombatantStatistics(statistics, createError) {
	assertRecord(statistics, 'statistics', createError);
	assertExactKeys(statistics, 'statistics', COMBATANT_STAT_IDS, [], createError);
	for (const statId of COMBATANT_STAT_IDS) {
		assertFiniteInRange(statistics[statId], `statistics.${statId}`, 0, 100, createError);
	}
}

function validateCombatantStatus(status, createError) {
	assertRecord(status, 'status', createError);
	assertExactKeys(status, 'status', ['effects', 'modifiers'], [], createError);
	validateDescribedRecords(status.effects, 'status.effects', createError, {
		selectionSource: true,
	});
	validateDescribedRecords(status.modifiers, 'status.modifiers', createError, {
		selectionSource: true,
	});
}

function validateCombatantResources(resources, createError) {
	assertRecord(resources, 'resources', createError);
	assertExactKeys(
		resources,
		'resources',
		COMBATANT_RESOURCE_IDS,
		[],
		createError,
	);
	for (const resourceId of COMBATANT_RESOURCE_IDS) {
		validateCombatantResource(
			resources[resourceId],
			`resources.${resourceId}`,
			createError,
			resourceId === 'ap',
		);
	}
}

function validateCombatantResource(resource, path, createError, actionPoints = false) {
	assertRecord(resource, path, createError);
	assertExactKeys(resource, path, ['current', 'max'], [], createError);
	const upperBound = actionPoints ? MAX_AP : Number.MAX_SAFE_INTEGER;
	assertFiniteInRange(resource.current, `${path}.current`, 0, upperBound, createError);
	assertFiniteInRange(resource.max, `${path}.max`, 0, upperBound, createError);
	if (resource.current > resource.max) {
		throw createError(`${path}.current cannot exceed ${path}.max.`);
	}
	if (actionPoints && (!Number.isInteger(resource.current) || !Number.isInteger(resource.max))) {
		throw createError(`${path} values must be whole numbers.`);
	}
}

function validateCombatantRules(rules, createError) {
	if (!Array.isArray(rules)) {
		throw createError('rules must be an array.');
	}
	for (const [index, rule] of rules.entries()) {
		const rulePath = `rules[${index}]`;
		assertRecord(rule, rulePath, createError);
		assertExactKeys(rule, rulePath, ['name', 'description', 'level'], ['entryId'], createError);
		assertNonEmptyString(rule.name, `${rulePath}.name`, createError);
		assertNonEmptyString(rule.description, `${rulePath}.description`, createError);
		assertIntegerInRange(
			rule.level,
			`${rulePath}.level`,
			1,
			Number.MAX_SAFE_INTEGER,
			createError,
		);
		if (rule.entryId !== undefined) {
			assertTechnicalId(rule.entryId, `${rulePath}.entryId`, createError);
		}
	}
}

function validateCombatantGear(gear, createError) {
	assertRecord(gear, 'gear', createError);
	assertExactKeys(gear, 'gear', ['equipment', 'inventory', 'encumbrance'], [], createError);
	validateStringList(gear.equipment, 'gear.equipment', createError);
	validateStringList(gear.inventory, 'gear.inventory', createError);
	validateCombatantResource(gear.encumbrance, 'gear.encumbrance', createError);
}

function validateDescribedRecords(records, path, createError, options = {}) {
	if (!Array.isArray(records)) {
		throw createError(`${path} must be an array.`);
	}
	for (const [index, record] of records.entries()) {
		const recordPath = `${path}[${index}]`;
		assertRecord(record, recordPath, createError);
		const optionalKeys = [];
		if (options.recordId) {
			optionalKeys.push(options.recordId);
		}
		if (options.selectionSource) {
			optionalKeys.push('generatorId', 'entryId', 'provenance');
		}
		assertExactKeys(record, recordPath, ['name', 'description'], optionalKeys, createError);
		assertNonEmptyString(record.name, `${recordPath}.name`, createError);
		assertNonEmptyString(record.description, `${recordPath}.description`, createError);
		if (options.recordId && record[options.recordId] !== undefined) {
			assertTechnicalId(
				record[options.recordId],
				`${recordPath}.${options.recordId}`,
				createError,
			);
		}
		if (options.selectionSource) {
			for (const idField of ['generatorId', 'entryId']) {
				if (record[idField] !== undefined) {
					assertTechnicalId(record[idField], `${recordPath}.${idField}`, createError);
				}
			}
			validateProvenance(record.provenance ?? [], `${recordPath}.provenance`, createError);
		}
	}
}

function validateProvenance(provenance, path, createError) {
	if (!Array.isArray(provenance)) {
		throw createError(`${path} must be an array.`);
	}
	for (const [index, record] of provenance.entries()) {
		const recordPath = `${path}[${index}]`;
		assertRecord(record, recordPath, createError);
		assertExactKeys(
			record,
			recordPath,
			['type', 'selection', 'generatorId', 'path'],
			['entryId'],
			createError,
		);
		assertNonEmptyString(record.type, `${recordPath}.type`, createError);
		assertNonEmptyString(record.selection, `${recordPath}.selection`, createError);
		assertTechnicalId(record.generatorId, `${recordPath}.generatorId`, createError);
		if (record.entryId !== undefined) {
			assertTechnicalId(record.entryId, `${recordPath}.entryId`, createError);
		}
		assertNonEmptyString(record.path, `${recordPath}.path`, createError);
	}
}

function validateStringList(value, path, createError) {
	if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
		throw createError(`${path} must be an array of strings.`);
	}
}

function validateNonEmptyStringList(value, path, createError) {
	validateStringList(value, path, createError);
	for (const [index, item] of value.entries()) {
		assertNonEmptyString(item, `${path}[${index}]`, createError);
	}
}

function assertRecord(value, path, createError) {
	if (!isRecord(value)) {
		throw createError(`${path} must be an object.`);
	}
}

function assertExactKeys(value, path, requiredKeys, optionalKeys = [], createError) {
	const allowedKeys = new Set([...requiredKeys, ...optionalKeys]);
	const missingKey = requiredKeys.find(key => !Object.hasOwn(value, key));
	if (missingKey) {
		throw createError(`${path} is missing ${missingKey}.`);
	}
	const unknownKey = Object.keys(value).find(key => !allowedKeys.has(key));
	if (unknownKey) {
		throw createError(`${path} contains unknown property ${unknownKey}.`);
	}
}

function assertString(value, path, createError) {
	if (typeof value !== 'string') {
		throw createError(`${path} must be a string.`);
	}
}

function assertNonEmptyString(value, path, createError) {
	assertString(value, path, createError);
	if (!value.trim()) {
		throw createError(`${path} must not be empty.`);
	}
}

function assertBoundedString(value, path, maximumLength, createError) {
	assertString(value, path, createError);
	if (value.length > maximumLength) {
		throw createError(`${path} must contain at most ${maximumLength} characters.`);
	}
}

function assertTechnicalId(value, path, createError) {
	if (typeof value !== 'string' || !TECHNICAL_ID.test(value)) {
		throw createError(`${path} must be a stable technical ID.`);
	}
}

function assertStatProfileId(value, path, createError) {
	if (typeof value !== 'string' || !STAT_PROFILE_ID.test(value)) {
		throw createError(`${path} must be a stable statistical profile ID.`);
	}
}

function assertIntegerInRange(value, path, minimum, maximum, createError) {
	if (!Number.isInteger(value) || value < minimum || value > maximum) {
		throw createError(`${path} must be an integer from ${minimum} to ${maximum}.`);
	}
}

function assertFiniteInRange(value, path, minimum, maximum, createError) {
	if (!Number.isFinite(value) || value < minimum || value > maximum) {
		throw createError(`${path} must be from ${minimum} to ${maximum}.`);
	}
}

function isRecord(value) {
	return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

module.exports = {
	COMBATANT_RESOURCE_IDS,
	COMBATANT_STAT_IDS,
	assertBoundedString,
	assertExactKeys,
	assertIntegerInRange,
	assertNonEmptyString,
	assertRecord,
	assertString,
	assertStatProfileId,
	assertTechnicalId,
	validateCombatantGear,
	validateCombatantLevel,
	validateCombatantResource,
	validateCombatantResources,
	validateCombatantRules,
	validateCombatantState,
	validateCombatantStatistics,
	validateCombatantStatus,
	validateDescribedRecords,
	validateNonEmptyStringList,
	validateProvenance,
	validateStringList,
	isRecord,
};

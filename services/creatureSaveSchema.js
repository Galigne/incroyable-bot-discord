const { validateEntityKey } = require('./entityStoragePaths');
const {
	COMBATANT_STAT_IDS,
	assertBoundedString,
	assertExactKeys,
	assertRecord,
	assertStatProfileId,
	assertTechnicalId,
	validateCombatantLevel,
	validateCombatantState,
	validateNonEmptyStringList,
	validateProvenance,
} = require('./combatantSaveSchema');
const { validateEntitySettings } = require('./entitySettings');
const CREATURE_STAT_IDS = COMBATANT_STAT_IDS;

function validateCreatureSaveSchema(rawSaveData, expectedKey = rawSaveData?.key) {
	assertRecord(rawSaveData, 'creature save', invalidSave);
	assertExactKeys(rawSaveData, 'creature save', [
		'type',
		'key',
		'settings',
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
	], [], invalidSave);

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
	validateEntitySettings(rawSaveData.settings, invalidSave);
	validateCombatantLevel(rawSaveData.level, invalidSave);
	assertBoundedString(rawSaveData.name, 'name', 256, invalidSave);
	assertBoundedString(rawSaveData.description, 'description', 4_000, invalidSave);
	validateSource(rawSaveData.source, invalidSave);
	validateCombatantState(rawSaveData, invalidSave);
	validateNonEmptyStringList(rawSaveData.traits, 'traits', invalidSave);
	return rawSaveData;
}

function validateSource(source, createError) {
	if (source === null) {
		return;
	}
	assertRecord(source, 'source', createError);
	assertExactKeys(source, 'source', [], [
		'generatorId',
		'entryId',
		'archetypeId',
		'statProfileId',
		'provenance',
	], createError);
	for (const field of [
		'generatorId',
		'entryId',
		'archetypeId',
		'statProfileId',
	]) {
		if (source[field] !== undefined && source[field] !== null) {
			if (field === 'statProfileId') {
				assertStatProfileId(source[field], `source.${field}`, createError);
			}
			else {
				assertTechnicalId(source[field], `source.${field}`, createError);
			}
		}
	}
	validateProvenance(source.provenance ?? [], 'source.provenance', createError);
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
	validateCreatureSaveSchema,
};

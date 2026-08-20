const { validateCharacterKey } = require('./entityStoragePaths');
const {
	assertBoundedString,
	assertExactKeys,
	assertRecord,
	isRecord,
	validateCombatantLevel,
	validateCombatantState,
	validateNonEmptyStringList,
} = require('./combatantSaveSchema');
const { validateEntityAccess } = require('./entityAccess');

const CURRENT_CHARACTER_SAVE_SCHEMA_VERSION = 4;

function validateCharacterSaveSchema(rawSaveData, expectedKey = rawSaveData?.key) {
	if (!isRecord(rawSaveData) || !Object.hasOwn(rawSaveData, 'schemaVersion')) {
		throw schemaVersionError(
			'MISSING_CHARACTER_SCHEMA_VERSION',
			'Character save is missing schemaVersion.',
		);
	}

	const { schemaVersion } = rawSaveData;
	if (!Number.isInteger(schemaVersion) || schemaVersion < 0) {
		throw schemaVersionError(
			'INVALID_CHARACTER_SCHEMA_VERSION',
			'Character save schemaVersion must be a non-negative integer.',
		);
	}
	if (schemaVersion !== CURRENT_CHARACTER_SAVE_SCHEMA_VERSION) {
		throw schemaVersionError(
			'UNSUPPORTED_CHARACTER_SCHEMA_VERSION',
			`Unsupported character save schemaVersion ${schemaVersion}; `
			+ `expected ${CURRENT_CHARACTER_SAVE_SCHEMA_VERSION}.`,
		);
	}
	assertExactKeys(rawSaveData, 'character save', [
		'schemaVersion',
		'key',
		'access',
		'name',
		'level',
		'race',
		'background',
		'personality',
		'statistics',
		'resources',
		'status',
		'rules',
		'talents',
		'gear',
	], [], invalidSave);

	try {
		validateCharacterKey(rawSaveData.key);
	}
	catch (error) {
		throw schemaError('INVALID_CHARACTER_KEY', 'Character save key is invalid.', error);
	}
	if (rawSaveData.key !== expectedKey) {
		throw schemaError(
			'CHARACTER_KEY_MISMATCH',
			'Character save key does not match its storage key.',
		);
	}
	validateEntityAccess(rawSaveData.access, invalidSave);
	validateCombatantLevel(rawSaveData.level, invalidSave);
	validateName(rawSaveData.name, invalidSave);
	validateRace(rawSaveData.race, invalidSave);
	validateBackground(rawSaveData.background, invalidSave);
	validatePersonality(rawSaveData.personality, invalidSave);
	validateCombatantState(rawSaveData, invalidSave);
	validateNonEmptyStringList(rawSaveData.talents, 'talents', invalidSave);
	return rawSaveData;
}

function validateName(name, createError) {
	assertRecord(name, 'name', createError);
	assertExactKeys(name, 'name', ['firstName', 'lastName'], [], createError);
	assertBoundedString(name.firstName, 'name.firstName', 256, createError);
	assertBoundedString(name.lastName, 'name.lastName', 256, createError);
}

function validateRace(race, createError) {
	assertRecord(race, 'race', createError);
	assertExactKeys(
		race,
		'race',
		['name', 'physicalDescription', 'lore', 'traits'],
		[],
		createError,
	);
	assertBoundedString(race.name, 'race.name', 256, createError);
	assertBoundedString(race.physicalDescription, 'race.physicalDescription', 4_000, createError);
	assertBoundedString(race.lore, 'race.lore', 4_000, createError);
	assertRecord(race.traits, 'race.traits', createError);
	assertExactKeys(
		race.traits,
		'race.traits',
		['skillBonus', 'physicalAbility'],
		[],
		createError,
	);
	assertBoundedString(
		race.traits.skillBonus,
		'race.traits.skillBonus',
		4_000,
		createError,
	);
	assertBoundedString(
		race.traits.physicalAbility,
		'race.traits.physicalAbility',
		4_000,
		createError,
	);
}

function validateBackground(background, createError) {
	assertRecord(background, 'background', createError);
	assertExactKeys(
		background,
		'background',
		['archetype', 'physicalDescription', 'backstory', 'goals'],
		[],
		createError,
	);
	assertBoundedString(background.archetype, 'background.archetype', 256, createError);
	assertBoundedString(
		background.physicalDescription,
		'background.physicalDescription',
		4_000,
		createError,
	);
	assertBoundedString(background.backstory, 'background.backstory', 4_000, createError);
	assertBoundedString(background.goals, 'background.goals', 4_000, createError);
}

function validatePersonality(personality, createError) {
	assertRecord(personality, 'personality', createError);
	assertExactKeys(personality, 'personality', ['traits', 'description'], [], createError);
	validateNonEmptyStringList(personality.traits, 'personality.traits', createError);
	assertBoundedString(personality.description, 'personality.description', 4_000, createError);
}

function invalidSave(message, cause) {
	return schemaError('INVALID_CHARACTER_SAVE', message, cause);
}

function schemaVersionError(code, message) {
	return schemaError(code, message);
}

function schemaError(code, message, cause) {
	const error = new Error(message, cause ? { cause } : undefined);
	error.name = 'CharacterSaveSchemaError';
	error.code = code;
	return error;
}

module.exports = {
	CURRENT_CHARACTER_SAVE_SCHEMA_VERSION,
	validateCharacterSaveSchema,
};

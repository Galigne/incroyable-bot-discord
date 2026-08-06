const CURRENT_CHARACTER_SAVE_SCHEMA_VERSION = 2;
const SUPPORTED_CHARACTER_SAVE_SCHEMA_VERSIONS = new Set([1, 2]);

function validateCharacterSaveSchema(rawSaveData) {
	if (
		rawSaveData === null
		|| typeof rawSaveData !== 'object'
		|| Array.isArray(rawSaveData)
		|| !Object.hasOwn(rawSaveData, 'schemaVersion')
	) {
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
	if (!SUPPORTED_CHARACTER_SAVE_SCHEMA_VERSIONS.has(schemaVersion)) {
		throw schemaVersionError(
			'UNSUPPORTED_CHARACTER_SCHEMA_VERSION',
			`Unsupported character save schemaVersion ${schemaVersion}; `
				+ `expected a supported version (1 or ${CURRENT_CHARACTER_SAVE_SCHEMA_VERSION}).`,
		);
	}

	return rawSaveData;
}

function migrateCharacterSave(rawSaveData) {
	validateCharacterSaveSchema(rawSaveData);
	if (rawSaveData.schemaVersion === CURRENT_CHARACTER_SAVE_SCHEMA_VERSION) {
		return rawSaveData;
	}

	return {
		schemaVersion: CURRENT_CHARACTER_SAVE_SCHEMA_VERSION,
		key: rawSaveData.key,
		creatorId: rawSaveData.creatorId,
		name: {
			firstName: rawSaveData.firstName,
			lastName: rawSaveData.lastName,
		},
		level: rawSaveData.level,
		race: {
			name: rawSaveData.race?.name,
			physicalDescription: rawSaveData.race?.physicalDescription,
			lore: rawSaveData.race?.lore,
			traits: {
				skillBonus: rawSaveData.racialTraits?.skillBonus,
				physicalAbility: rawSaveData.racialTraits?.physicalAbility,
			},
		},
		background: {
			appearance: rawSaveData.appearance,
			backstory: rawSaveData.backstory,
			goals: rawSaveData.goals,
		},
		personality: rawSaveData.personality,
		statistics: rawSaveData.stats,
		status: {
			...rawSaveData.resources,
			effects: rawSaveData.statusEffects,
		},
		rules: rawSaveData.rules,
		talents: rawSaveData.talents,
		gear: {
			equipment: rawSaveData.equipment,
			inventory: rawSaveData.inventory,
			encumbrance: rawSaveData.encumbrance,
		},
		modifiers: [],
	};
}

function schemaVersionError(code, message) {
	const error = new Error(message);
	error.name = 'CharacterSaveSchemaError';
	error.code = code;
	return error;
}

module.exports = {
	CURRENT_CHARACTER_SAVE_SCHEMA_VERSION,
	migrateCharacterSave,
	validateCharacterSaveSchema,
};

const CURRENT_CHARACTER_SAVE_SCHEMA_VERSION = 1;

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
	if (schemaVersion !== CURRENT_CHARACTER_SAVE_SCHEMA_VERSION) {
		throw schemaVersionError(
			'UNSUPPORTED_CHARACTER_SCHEMA_VERSION',
			`Unsupported character save schemaVersion ${schemaVersion}; `
				+ `expected ${CURRENT_CHARACTER_SAVE_SCHEMA_VERSION}.`,
		);
	}

	return rawSaveData;
}

function schemaVersionError(code, message) {
	const error = new Error(message);
	error.name = 'CharacterSaveSchemaError';
	error.code = code;
	return error;
}

module.exports = {
	CURRENT_CHARACTER_SAVE_SCHEMA_VERSION,
	validateCharacterSaveSchema,
};

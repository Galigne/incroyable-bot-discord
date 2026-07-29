const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, afterEach, test } = require('node:test');

const testSaveDirectory = fs.mkdtempSync(
	path.join(os.tmpdir(), 'incredible-bot-save-schema-'),
);
process.env.INCREDIBLE_BOT_SAVE_DIRECTORY = testSaveDirectory;

const {
	CURRENT_CHARACTER_SAVE_SCHEMA_VERSION,
} = require('../services/characterSaveSchema');
const {
	getEditableFields,
	getViewableFields,
} = require('../services/characterFieldCatalog');
const {
	CharacterLoadError,
	createCharacter,
	getCharacter,
	listCharacters,
	updateCharacter,
} = require('../services/characterStore');
const {
	createCharacterFieldEmbed,
	createCharacterSummaryEmbed,
} = require('../util/characterRenderer');

afterEach(() => {
	for (const entry of fs.readdirSync(testSaveDirectory)) {
		fs.rmSync(path.join(testSaveDirectory, entry), {
			force: true,
			recursive: true,
		});
	}
});

after(() => {
	fs.rmSync(testSaveDirectory, { recursive: true, force: true });
});

test('newly created characters persist the current schema version', async () => {
	const characterKey = 'Schema.Created';
	const character = await createCharacter(characterKey, 'creator');
	const rawSave = await readRawSave(characterKey);

	assert.equal(character.schemaVersion, CURRENT_CHARACTER_SAVE_SCHEMA_VERSION);
	assert.equal(
		rawSave.schemaVersion,
		CURRENT_CHARACTER_SAVE_SCHEMA_VERSION,
	);
});

test('current-version saves load successfully', async () => {
	const characterKey = 'Schema.Current';
	await writeRawSave(characterKey, {
		schemaVersion: CURRENT_CHARACTER_SAVE_SCHEMA_VERSION,
		creatorId: 'creator',
		firstName: 'Current',
	});

	const character = await getCharacter(characterKey);

	assert.equal(character.schemaVersion, CURRENT_CHARACTER_SAVE_SCHEMA_VERSION);
	assert.equal(character.creatorId, 'creator');
	assert.equal(character.firstName, 'Current');
});

test('saves without schemaVersion are rejected without being rewritten', async () => {
	const characterKey = 'Schema.Missing';
	const originalSave = await writeRawSave(characterKey, {
		creatorId: 'creator',
	});

	await assert.rejects(
		getCharacter(characterKey),
		{ code: 'MISSING_CHARACTER_SCHEMA_VERSION' },
	);
	assert.equal(await readSaveText(characterKey), originalSave);
});

test('unsupported schema versions are rejected without being rewritten', async () => {
	const characterKey = 'Schema.Unsupported';
	for (const schemaVersion of [
		0,
		CURRENT_CHARACTER_SAVE_SCHEMA_VERSION + 1,
	]) {
		const originalSave = await writeRawSave(characterKey, {
			schemaVersion,
			creatorId: 'creator',
		});

		await assert.rejects(
			getCharacter(characterKey),
			{ code: 'UNSUPPORTED_CHARACTER_SCHEMA_VERSION' },
		);
		assert.equal(await readSaveText(characterKey), originalSave);
	}
});

test('malformed schemaVersion values are rejected', async () => {
	const characterKey = 'Schema.Invalid';
	const invalidVersions = [
		null,
		true,
		'1',
		-1,
		1.5,
		{},
		[],
	];

	for (const schemaVersion of invalidVersions) {
		const originalSave = await writeRawSave(characterKey, {
			schemaVersion,
			creatorId: 'creator',
		});
		await assert.rejects(
			getCharacter(characterKey),
			{ code: 'INVALID_CHARACTER_SCHEMA_VERSION' },
			`schemaVersion ${JSON.stringify(schemaVersion)}`,
		);
		assert.equal(await readSaveText(characterKey), originalSave);
	}
});

test('character listing skips and reports saves with invalid versions', async () => {
	await writeRawSave('Schema.Listed.Valid', {
		schemaVersion: CURRENT_CHARACTER_SAVE_SCHEMA_VERSION,
		creatorId: 'creator',
		firstName: 'Valid',
	});
	const invalidSave = await writeRawSave('Schema.Listed.Invalid', {
		schemaVersion: CURRENT_CHARACTER_SAVE_SCHEMA_VERSION + 1,
		creatorId: 'creator',
	});
	const errors = [];

	const characters = await listCharacters({
		onLoadError: error => errors.push(error),
	});

	assert.deepEqual(characters.map(character => character.key), [
		'Schema.Listed.Valid',
	]);
	assert.equal(errors.length, 1);
	assert.ok(errors[0] instanceof CharacterLoadError);
	assert.equal(errors[0].code, 'INVALID_CHARACTER_SAVE');
	assert.equal(errors[0].characterKey, 'Schema.Listed.Invalid');
	assert.equal(
		errors[0].cause.code,
		'UNSUPPORTED_CHARACTER_SCHEMA_VERSION',
	);
	assert.equal(
		await readSaveText('Schema.Listed.Invalid'),
		invalidSave,
	);
});

test('character updates preserve schemaVersion', async () => {
	const characterKey = 'Schema.Updated';
	await createCharacter(characterKey, 'creator');

	const character = await updateCharacter(
		characterKey,
		() => true,
		currentCharacter => {
			currentCharacter.firstName = 'Updated';
		},
	);
	const rawSave = await readRawSave(characterKey);

	assert.equal(character.schemaVersion, CURRENT_CHARACTER_SAVE_SCHEMA_VERSION);
	assert.equal(character.firstName, 'Updated');
	assert.equal(
		rawSave.schemaVersion,
		CURRENT_CHARACTER_SAVE_SCHEMA_VERSION,
	);
	assert.equal(rawSave.firstName, 'Updated');
});

test('schemaVersion is excluded from character editing and display surfaces', async () => {
	const character = await createCharacter('Schema.Hidden', 'creator');
	const editableFieldIds = getEditableFields().map(field => field.id);
	const viewableFieldIds = getViewableFields().map(field => field.id);
	const summary = createCharacterSummaryEmbed(character).toJSON();

	assert.equal(editableFieldIds.includes('schemaVersion'), false);
	assert.equal(viewableFieldIds.includes('schemaVersion'), false);
	assert.equal(
		createCharacterFieldEmbed(character, 'schemaVersion'),
		null,
	);
	assert.doesNotMatch(JSON.stringify(summary), /schemaVersion/);
});

function getSavePath(characterKey) {
	return path.join(testSaveDirectory, `${characterKey}.json`);
}

async function readRawSave(characterKey) {
	return JSON.parse(await readSaveText(characterKey));
}

async function readSaveText(characterKey) {
	return fsPromises.readFile(getSavePath(characterKey), 'utf8');
}

async function writeRawSave(characterKey, rawSave) {
	const serializedSave = JSON.stringify(rawSave, null, 2);
	await fsPromises.writeFile(
		getSavePath(characterKey),
		serializedSave,
		'utf8',
	);
	return serializedSave;
}

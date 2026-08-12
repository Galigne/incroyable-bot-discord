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
	getCharacterSavePath,
} = require('../services/entityStoragePaths');
const { generateCharacter } = require('../services/characterApplicationService');
const generatorCatalog = require('../services/generatorCatalog');
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
	assert.deepEqual(Object.keys(rawSave), [
		'schemaVersion',
		'key',
		'creatorId',
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
	]);
	assert.equal(Object.hasOwn(rawSave, 'firstName'), false);
	assert.deepEqual(rawSave.status, { effects: [], modifiers: [] });
	assert.deepEqual(Object.keys(rawSave.resources), ['hp', 'ar', 'ap', 'md']);
});

test('current-version saves load successfully', async () => {
	const characterKey = 'Schema.Current';
	await writeRawSave(characterKey, {
		schemaVersion: CURRENT_CHARACTER_SAVE_SCHEMA_VERSION,
		creatorId: 'creator',
		name: { firstName: 'Current', lastName: '' },
	});

	const character = await getCharacter(characterKey);

	assert.equal(character.schemaVersion, CURRENT_CHARACTER_SAVE_SCHEMA_VERSION);
	assert.equal(character.creatorId, 'creator');
	assert.equal(character.name.firstName, 'Current');
});

test('unsupported previous schemas are rejected without rewriting', async () => {
	for (const schemaVersion of [1, 2]) {
		const characterKey = `Schema.Legacy.${schemaVersion}`;
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

test('/gen-char consumes current generator fields and persists the current schema', async () => {
	const characterKey = 'Schema.Generated';
	const generated = await generateCharacter(characterKey, 'creator', {
		formatGold: gold => `${gold} gold`,
		level: 1,
		locale: 'en',
		random: () => 0,
	});
	const rawSave = await readRawSave(characterKey);
	const nameEntry = generatorCatalog.getGenerator('name', 'en').entries[0];
	const raceEntry = generatorCatalog.getGenerator('race', 'en').entries[0];

	assert.equal(rawSave.schemaVersion, CURRENT_CHARACTER_SAVE_SCHEMA_VERSION);
	assert.deepEqual(rawSave.name, {
		firstName: nameEntry.fields.first_name,
		lastName: nameEntry.fields.last_name,
	});
	assert.equal(rawSave.race.name, raceEntry.fields.name);
	assert.equal(rawSave.race.physicalDescription, raceEntry.fields.description);
	assert.equal(rawSave.race.traits.skillBonus, raceEntry.fields.skill_bonus);
	assert.equal(
		rawSave.race.traits.physicalAbility,
		raceEntry.fields.physical_ability,
	);
	assert.ok(rawSave.background.archetype);
	assert.ok(rawSave.background.physicalDescription);
	assert.equal(rawSave.background.backstory, '');
	assert.equal(rawSave.background.goals, '');
	assert.ok(rawSave.statistics.constitution);
	assert.ok(rawSave.resources.hp.max);
	const statusEntry = generatorCatalog.getGenerator('status_effect', 'en').entries[0];
	assert.deepEqual(rawSave.status.effects, [
		{
			name: statusEntry.fields.name,
			description: statusEntry.fields.description,
		},
	]);
	assert.deepEqual(rawSave.status.modifiers.map(modifier => [
		modifier.generatorId,
		modifier.entryId,
	]), [['modifier_character', 'scarred']]);
	assert.ok(rawSave.gear.equipment.length >= 2);
	assert.equal(rawSave.gear.inventory.length, 4);
	assert.deepEqual(rawSave.gear.encumbrance, { current: 0, max: 0 });
	assert.deepEqual(JSON.parse(JSON.stringify(generated)), rawSave);
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
		name: { firstName: 'Valid', lastName: '' },
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
			currentCharacter.name.firstName = 'Updated';
		},
	);
	const rawSave = await readRawSave(characterKey);

	assert.equal(character.schemaVersion, CURRENT_CHARACTER_SAVE_SCHEMA_VERSION);
	assert.equal(character.name.firstName, 'Updated');
	assert.equal(
		rawSave.schemaVersion,
		CURRENT_CHARACTER_SAVE_SCHEMA_VERSION,
	);
	assert.equal(rawSave.name.firstName, 'Updated');
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
	return getCharacterSavePath(characterKey);
}

async function readRawSave(characterKey) {
	return JSON.parse(await readSaveText(characterKey));
}

async function readSaveText(characterKey) {
	return fsPromises.readFile(getSavePath(characterKey), 'utf8');
}

async function writeRawSave(characterKey, rawSave) {
	const serializedSave = JSON.stringify(rawSave, null, 2);
	await fsPromises.mkdir(path.dirname(getSavePath(characterKey)), {
		recursive: true,
	});
	await fsPromises.writeFile(
		getSavePath(characterKey),
		serializedSave,
		'utf8',
	);
	return serializedSave;
}

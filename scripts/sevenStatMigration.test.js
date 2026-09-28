const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');

const Character = require('../models/Character');
const Creature = require('../models/Creature');
const {
	CURRENT_CHARACTER_SAVE_SCHEMA_VERSION,
	validateCharacterSaveSchema,
} = require('../services/characterSaveSchema');
const {
	CURRENT_CREATURE_SAVE_SCHEMA_VERSION,
	validateCreatureSaveSchema,
} = require('../services/creatureSaveSchema');
const {
	migrateSevenStatisticsSaves,
} = require('./migrateSevenStatisticsSaves');

const testSaveRoot = fs.mkdtempSync(
	path.join(os.tmpdir(), 'incredible-bot-seven-stat-migration-'),
);

after(() => {
	fs.rmSync(testSaveRoot, { recursive: true, force: true });
});

test('one-time migration updates active and historical snapshots only as intended', async () => {
	const character = createLegacyCharacter('Migration.Character');
	character.name.firstName = 'Preserved';
	character.gear.inventory = ['Unchanged item'];
	const creature = createLegacyCreature('Migration.Creature');
	creature.name = 'Preserved creature';
	creature.traits = ['Unchanged trait'];
	const characterHistory = {
		entries: [
			createHistoryEntry(character, 'character', '2026-01-01T00:00:00.000Z'),
			createHistoryEntry(character, 'character', '2026-01-02T00:00:00.000Z'),
		],
	};
	const creatureHistory = {
		entries: [
			createHistoryEntry(creature, 'creature', '2026-01-03T00:00:00.000Z'),
		],
	};

	await writeFixture('characters/Migration.Character.json', character);
	await writeFixture(
		'characters/.history/Migration.Character.json',
		characterHistory,
	);
	await writeFixture('creatures/Migration.Creature.json', creature);
	await writeFixture(
		'creatures/.history/Migration.Creature.json',
		creatureHistory,
	);

	assert.deepEqual(await migrateSevenStatisticsSaves(testSaveRoot), {
		filesScanned: 4,
		filesUpdated: 4,
		snapshotsUpdated: 5,
	});

	const migratedCharacter = await readFixture('characters/Migration.Character.json');
	const migratedCreature = await readFixture('creatures/Migration.Creature.json');
	const migratedCharacterHistory = await readFixture(
		'characters/.history/Migration.Character.json',
	);
	const migratedCreatureHistory = await readFixture(
		'creatures/.history/Migration.Creature.json',
	);
	assert.deepEqual(migratedCharacter, expectedMigration(
		character,
		CURRENT_CHARACTER_SAVE_SCHEMA_VERSION,
	));
	assert.deepEqual(migratedCreature, expectedMigration(
		creature,
		CURRENT_CREATURE_SAVE_SCHEMA_VERSION,
	));
	assert.deepEqual(migratedCharacterHistory, {
		entries: characterHistory.entries.map(entry => ({
			...entry,
			character: expectedMigration(
				entry.character,
				CURRENT_CHARACTER_SAVE_SCHEMA_VERSION,
			),
		})),
	});
	assert.deepEqual(migratedCreatureHistory, {
		entries: creatureHistory.entries.map(entry => ({
			...entry,
			creature: expectedMigration(
				entry.creature,
				CURRENT_CREATURE_SAVE_SCHEMA_VERSION,
			),
		})),
	});
	assert.equal(validateCharacterSaveSchema(migratedCharacter), migratedCharacter);
	assert.equal(validateCreatureSaveSchema(migratedCreature), migratedCreature);

	assert.deepEqual(await migrateSevenStatisticsSaves(testSaveRoot), {
		filesScanned: 4,
		filesUpdated: 0,
		snapshotsUpdated: 0,
	});
});

function createLegacyCharacter(key) {
	const value = JSON.parse(JSON.stringify(new Character(key)));
	value.schemaVersion = CURRENT_CHARACTER_SAVE_SCHEMA_VERSION - 1;
	value.statistics.initiative = value.statistics.speed;
	value.statistics.reflexes = value.statistics.speed;
	return value;
}

function createLegacyCreature(key) {
	const value = JSON.parse(JSON.stringify(new Creature(key)));
	value.schemaVersion = CURRENT_CREATURE_SAVE_SCHEMA_VERSION - 1;
	value.statistics.initiative = value.statistics.speed;
	value.statistics.reflexes = value.statistics.speed;
	return value;
}

function createHistoryEntry(snapshot, entityProperty, createdAt) {
	return {
		createdAt,
		actorId: 'migration-test',
		action: 'set',
		[entityProperty]: structuredClone(snapshot),
	};
}

function expectedMigration(snapshot, schemaVersion) {
	const migrated = structuredClone(snapshot);
	migrated.schemaVersion = schemaVersion;
	delete migrated.statistics.initiative;
	delete migrated.statistics.reflexes;
	return migrated;
}

async function writeFixture(relativePath, value) {
	const filePath = path.join(testSaveRoot, relativePath);
	await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
	await fsPromises.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
}

async function readFixture(relativePath) {
	return JSON.parse(await fsPromises.readFile(
		path.join(testSaveRoot, relativePath),
		'utf8',
	));
}

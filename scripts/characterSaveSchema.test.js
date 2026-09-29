const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, afterEach, test } = require('node:test');
const { MessageFlags } = require('discord.js');

const testSaveDirectory = fs.mkdtempSync(
	path.join(os.tmpdir(), 'incredible-bot-save-schema-'),
);
process.env.INCREDIBLE_BOT_SAVE_DIRECTORY = testSaveDirectory;

const Character = require('../models/Character');
const { BASE_STATS } = require('../services/mechanics/constants');
const commandRegistry = require('../commands/registry');
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
const {
	createGeneratedCharacterResponse,
} = require('../util/characterCommandResponses');
const { createEntityGetResponse } = require('../util/entityCommandResponses');

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

test('newly created characters persist the exact versionless settings shape', async () => {
	const characterKey = 'Schema.Created';
	const character = await createCharacter(characterKey, ownerAccess('creator'));
	const rawSave = await readRawSave(characterKey);

	assert.equal(Object.hasOwn(character, 'schemaVersion'), false);
	assert.deepEqual(Object.keys(rawSave), [
		'key',
		'settings',
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
	assert.deepEqual(rawSave.settings, {
		visibility: 'public',
		access: ownerAccess('creator'),
	});
	assert.equal(Object.hasOwn(rawSave, 'firstName'), false);
	assert.deepEqual(rawSave.status, { effects: [], modifiers: [] });
	assert.deepEqual(Object.keys(rawSave.statistics), BASE_STATS);
	assert.deepEqual(Object.keys(rawSave.resources), ['hp', 'ar', 'ap', 'md']);
});

test('versionless saves load successfully', async () => {
	const characterKey = 'Schema.Current';
	const save = createValidCharacterSave(characterKey);
	save.name.firstName = 'Current';
	await writeRawSave(characterKey, save);

	const character = await getCharacter(characterKey);

	assert.deepEqual(character.settings, {
		visibility: 'public',
		access: ownerAccess('creator'),
	});
	assert.equal(character.name.firstName, 'Current');
});

test('schemaVersion is rejected as an unknown save property without rewriting', async () => {
	const characterKey = 'Schema.Versioned';
	const save = createValidCharacterSave(characterKey);
	save.schemaVersion = 5;
	const originalSave = await writeRawSave(characterKey, save);
	await assert.rejects(getCharacter(characterKey), { code: 'INVALID_CHARACTER_SAVE' });
	assert.equal(await readSaveText(characterKey), originalSave);
});

test('/gen-character consumes generator fields and persists private versionless settings', async () => {
	const characterKey = 'Schema.Generated';
	const generated = await generateCharacter(characterKey, {
		formatGold: gold => `${gold} gold`,
		level: 1,
		locale: 'en',
		random: () => 0,
	});
	const rawSave = await readRawSave(characterKey);
	const nameEntry = generatorCatalog.getGenerator('name', 'en').entries[0];
	const raceEntry = generatorCatalog.getGenerator('race', 'en').entries[0];

	assert.equal(Object.hasOwn(rawSave, 'schemaVersion'), false);
	assert.deepEqual(rawSave.settings, { visibility: 'private', access: [] });
	assert.deepEqual(rawSave.name, {
		firstName: nameEntry.fields.first_name,
		lastName: nameEntry.fields.last_name,
	});
	assert.equal(rawSave.race.name, raceEntry.name);
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
	assert.deepEqual(Object.keys(rawSave.statistics), BASE_STATS);
	assert.ok(rawSave.resources.hp.max);
	const statusEntry = generatorCatalog.getGenerator('status_effect', 'en').entries[0];
	assert.deepEqual(rawSave.status.effects, [
		{
			name: statusEntry.name,
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

test('/gen-character sends personality and populated gear after its unchanged summary', async () => {
	const characterKey = 'Command.Generated';
	const replies = [];
	const followUps = [];
	const interaction = {
		user: { id: 'creator' },
		options: {
			getInteger: option => option === 'level' ? 1 : null,
			getString: option => option === 'character-key' ? characterKey : null,
		},
		reply: async response => replies.push(response),
		followUp: async response => followUps.push(response),
	};

	await commandRegistry.getRuntimeCommands().get('gen-character').execute({
		config: { locale: 'en' },
		interaction,
	});

	const generated = await getCharacter(characterKey);
	assert.equal(replies.length, 1);
	assert.equal(replies[0].flags, MessageFlags.Ephemeral);
	assert.deepEqual(
		replies[0].embeds[0].toJSON(),
		createGeneratedCharacterResponse(generated, 'en').embeds[0].toJSON(),
	);
	assert.equal(followUps.length, 2);
	assert.ok(followUps.every(response => response.flags === MessageFlags.Ephemeral));
	assert.deepEqual(
		followUps[0].embeds[0].toJSON(),
		createEntityGetResponse(generated, 'personality', 'en').embeds[0].toJSON(),
	);
	assert.deepEqual(
		followUps[1].embeds[0].toJSON(),
		createEntityGetResponse(generated, 'gear', 'en').embeds[0].toJSON(),
	);
	assert.doesNotMatch(
		JSON.stringify(followUps),
		/Derived statistics|Initiative|Reflexes|RULE descriptions/,
	);
});

test('character listing skips and reports structurally invalid versionless saves', async () => {
	await writeRawSave(
		'Schema.Listed.Valid',
		createValidCharacterSave('Schema.Listed.Valid'),
	);
	const malformed = createValidCharacterSave('Schema.Listed.Invalid');
	delete malformed.settings;
	const invalidSave = await writeRawSave('Schema.Listed.Invalid', malformed);
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
	assert.equal(errors[0].cause.code, 'INVALID_CHARACTER_SAVE');
	assert.equal(
		await readSaveText('Schema.Listed.Invalid'),
		invalidSave,
	);
});

test('character updates preserve versionless settings', async () => {
	const characterKey = 'Schema.Updated';
	await createCharacter(characterKey, ownerAccess('creator'));

	const character = await updateCharacter(
		characterKey,
		() => true,
		currentCharacter => {
			currentCharacter.name.firstName = 'Updated';
		},
	);
	const rawSave = await readRawSave(characterKey);

	assert.equal(character.name.firstName, 'Updated');
	assert.equal(Object.hasOwn(rawSave, 'schemaVersion'), false);
	assert.deepEqual(rawSave.settings.access, ownerAccess('creator'));
	assert.equal(rawSave.name.firstName, 'Updated');
});

test('schema metadata is absent from character editing and display surfaces', async () => {
	const character = await createCharacter('Schema.Hidden', ownerAccess('creator'));
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

test('character saves reject incomplete or malformed persisted combatant state', async () => {
	const cases = [
		['missing statistics', save => delete save.statistics],
		['obsolete initiative statistic', save => {
			save.statistics.initiative = save.statistics.speed;
		}],
		['obsolete reflexes statistic', save => {
			save.statistics.reflexes = save.statistics.speed;
		}],
		['incomplete resources', save => delete save.resources.hp.max],
		['invalid status effect', save => {
			save.status.effects = [{ name: 'Broken' }];
		}],
		['invalid RULE', save => {
			save.rules = [{ name: 'Broken', description: '', level: 1 }];
		}],
		['incomplete gear', save => delete save.gear.encumbrance.current],
		['persisted none access', save => {
			save.settings.access = [{ userId: 'creator', level: 'none' }];
		}],
		['duplicate access user', save => {
			save.settings.access.push({ userId: 'creator', level: 'partial' });
		}],
		['malformed access entry', save => {
			save.settings.access = [{ userId: '', level: 'owner' }];
		}],
		['invalid visibility', save => {
			save.settings.visibility = 'hidden';
		}],
		['unknown settings property', save => {
			save.settings.extra = true;
		}],
	];

	for (const [label, mutate] of cases) {
		const characterKey = `Schema.Invalid.${label.replaceAll(' ', '.')}`;
		const save = createValidCharacterSave(characterKey);
		mutate(save);
		const originalSave = await writeRawSave(characterKey, save);
		await assert.rejects(
			getCharacter(characterKey),
			{ code: 'INVALID_CHARACTER_SAVE' },
			label,
		);
		assert.equal(await readSaveText(characterKey), originalSave);
	}
});

function createValidCharacterSave(characterKey) {
	return JSON.parse(JSON.stringify(new Character(characterKey, ownerAccess('creator'))));
}

function ownerAccess(userId) {
	return [{ userId, level: 'owner' }];
}

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

const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');

const testSaveDirectory = fs.mkdtempSync(
	path.join(os.tmpdir(), 'incredible-bot-entities-'),
);
process.env.INCREDIBLE_BOT_SAVE_DIRECTORY = testSaveDirectory;

const Character = require('../models/Character');
const Creature = require('../models/Creature');
const {
	getEntityChoices,
	getEntitySectionChoices,
} = require('../commands/entity/autocomplete');
const { COMMAND_METADATA } = require('../commands/metadata');
const {
	getCharacterSections,
} = require('../services/characterFieldCatalog');
const {
	getCreatureSections,
} = require('../services/creatureFieldCatalog');
const {
	createEntity,
	damageEntity,
	deleteEntity,
	getEntity,
	listEntities,
	undoEntity,
	updateEditableEntity,
} = require('../services/entityApplicationService');
const {
	commitPermanentDeletion,
} = require('../services/characterPersistenceTransaction');
const {
	characterHistoryDirectory,
	characterSaveDirectory,
	creatureHistoryDirectory,
	creatureSaveDirectory,
	getCharacterHistoryPath,
	getCharacterSavePath,
	getCreatureHistoryPath,
	getCreatureSavePath,
	saveRootDirectory,
} = require('../services/characterStoragePaths');
const {
	CURRENT_CREATURE_SAVE_SCHEMA_VERSION,
	validateCreatureSaveSchema,
} = require('../services/creatureSaveSchema');
const {
	getEntityOperationQueueSize,
} = require('../services/characterOperationQueue');
const { updateCreature } = require('../services/creatureStore');
const commandRegistry = require('../commands/registry');

after(() => {
	fs.rmSync(testSaveDirectory, { recursive: true, force: true });
});

test('entity storage paths use symmetric type directories beneath the configured root', () => {
	assert.equal(saveRootDirectory, testSaveDirectory);
	assert.equal(
		characterSaveDirectory,
		path.join(testSaveDirectory, 'characters'),
	);
	assert.equal(
		characterHistoryDirectory,
		path.join(testSaveDirectory, 'characters', '.history'),
	);
	assert.equal(
		creatureSaveDirectory,
		path.join(testSaveDirectory, 'creatures'),
	);
	assert.equal(
		creatureHistoryDirectory,
		path.join(testSaveDirectory, 'creatures', '.history'),
	);
	assert.equal(
		getCharacterSavePath('Canonical.Character'),
		path.join(testSaveDirectory, 'characters', 'Canonical.Character.json'),
	);
	assert.equal(
		getCharacterHistoryPath('Canonical.Character'),
		path.join(
			testSaveDirectory,
			'characters',
			'.history',
			'Canonical.Character.json',
		),
	);
	assert.equal(
		getCreatureSavePath('Canonical.Creature'),
		path.join(testSaveDirectory, 'creatures', 'Canonical.Creature.json'),
	);
	assert.equal(
		getCreatureHistoryPath('Canonical.Creature'),
		path.join(
			testSaveDirectory,
			'creatures',
			'.history',
			'Canonical.Creature.json',
		),
	);
});

test('blank creatures use a strict persistent schema with immutable identity', () => {
	const creature = new Creature('Creature.Blank', 'creator');
	assert.equal(creature.schemaVersion, CURRENT_CREATURE_SAVE_SCHEMA_VERSION);
	assert.equal(creature.type, 'creature');
	assert.equal(creature.key, 'Creature.Blank');
	assert.equal(Object.getOwnPropertyDescriptor(creature, 'type').writable, false);
	assert.equal(Object.getOwnPropertyDescriptor(creature, 'key').writable, false);
	assert.deepEqual(creature.gear.encumbrance, { current: 0, max: 0 });
	assert.deepEqual(creature.naturalArmor, { percentage: 0 });
	assert.deepEqual(Object.keys(creature), [
		'schemaVersion',
		'type',
		'key',
		'creatorId',
		'level',
		'name',
		'description',
		'source',
		'naturalArmor',
		'statistics',
		'status',
		'traits',
		'rules',
		'modifiers',
		'gear',
	]);
	assert.equal(validateCreatureSaveSchema(creature), creature);
});

test('creature hydration preserves final localized state and technical provenance', () => {
	const saved = JSON.parse(JSON.stringify(new Creature('Creature.Hydrated', 'creator')));
	saved.name = 'Ash Wolf';
	saved.description = 'A scarred guardian.';
	saved.source = {
		generatorId: 'creature-monster',
		entryId: 'ash-wolf',
		archetypeId: 'monster',
		statProfileId: 'creature-balanced',
		provenance: [{
			type: 'entry',
			selection: 'random',
			generatorId: 'creature-monster',
			entryId: 'ash-wolf',
			path: 'root',
		}],
	};
	saved.naturalArmor.percentage = 25;
	saved.status.ar = { current: 30, max: 30 };
	saved.traits = [{
		name: 'Keen Scent',
		description: 'Tracks by scent.',
		id: 'keen-scent',
	}];
	saved.status.effects = [{
		generatorId: 'status-effect',
		entryId: 'burning',
		name: 'Burning',
		description: 'Flames cling to the target.',
		provenance: [{
			type: 'entry',
			selection: 'random',
			generatorId: 'status-effect',
			entryId: 'burning',
			path: 'root.status-effects',
		}],
	}];
	saved.modifiers = [{
		generatorId: 'modifier',
		entryId: 'scarred',
		name: 'Scarred',
		description: 'Old wounds cross its hide.',
		provenance: [{
			type: 'entry',
			selection: 'random',
			generatorId: 'modifier',
			entryId: 'scarred',
			path: 'root.modifiers',
		}],
	}];

	validateCreatureSaveSchema(saved);
	const hydrated = Creature.fromSave(saved);
	assert.equal(hydrated.name, 'Ash Wolf');
	assert.equal(hydrated.status.ar.max, 30);
	assert.equal(hydrated.naturalArmor.percentage, 25);
	assert.deepEqual(hydrated.source, saved.source);
	assert.deepEqual(hydrated.status.effects, saved.status.effects);
	assert.deepEqual(hydrated.modifiers, saved.modifiers);
	saved.source.entryId = 'changed-after-hydration';
	assert.equal(hydrated.source.entryId, 'ash-wolf');
});

test('creature saves reject missing, unsupported, mismatched, and invalid state', () => {
	assert.throws(
		() => validateCreatureSaveSchema({}),
		error => error.code === 'MISSING_CREATURE_SCHEMA_VERSION',
	);
	const unsupported = JSON.parse(JSON.stringify(new Creature('Schema.Bad', 'creator')));
	unsupported.schemaVersion = 99;
	assert.throws(
		() => validateCreatureSaveSchema(unsupported),
		error => error.code === 'UNSUPPORTED_CREATURE_SCHEMA_VERSION',
	);
	const mismatched = JSON.parse(JSON.stringify(new Creature('Schema.One', 'creator')));
	assert.throws(
		() => validateCreatureSaveSchema(mismatched, 'Schema.Two'),
		error => error.code === 'CREATURE_KEY_MISMATCH',
	);
	const invalid = JSON.parse(JSON.stringify(new Creature('Schema.Invalid', 'creator')));
	invalid.status.hp.current = 101;
	assert.throws(
		() => validateCreatureSaveSchema(invalid),
		error => error.code === 'INVALID_CREATURE_SAVE',
	);
	const unknown = JSON.parse(JSON.stringify(new Creature('Schema.Unknown', 'creator')));
	unknown.generatedAt = new Date().toISOString();
	assert.throws(
		() => validateCreatureSaveSchema(unknown),
		error => error.code === 'INVALID_CREATURE_SAVE',
	);
});

test('character saves retain schema v2 without a required discriminator', () => {
	const character = new Character('Character.Compatible', 'creator');
	const saved = JSON.parse(JSON.stringify(character));
	assert.equal(saved.schemaVersion, 2);
	assert.equal(Object.hasOwn(saved, 'type'), false);
	assert.deepEqual(Object.keys(saved), [
		'schemaVersion',
		'key',
		'creatorId',
		'name',
		'level',
		'race',
		'background',
		'personality',
		'statistics',
		'status',
		'rules',
		'talents',
		'gear',
		'modifiers',
	]);
});

test('concurrent cross-type creation enforces global EntityKey uniqueness', async () => {
	const entityKey = 'Collision.Concurrent';
	const results = await Promise.allSettled([
		createEntity(entityKey, 'character', 'character-owner'),
		createEntity(entityKey, 'creature', 'creature-owner'),
	]);
	assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
	const rejection = results.find(result => result.status === 'rejected');
	assert.equal(rejection.reason.code, 'EEXIST');
	assert.equal((await listEntities()).filter(entity => entity.key === entityKey).length, 1);
	assert.equal(getEntityOperationQueueSize(), 0);
});

test('retained history reserves its key against a different concrete type', async () => {
	const entityKey = 'Collision.History';
	await createEntity(entityKey, 'creature', 'creature-owner');
	await damageEntity(
		entityKey,
		1,
		false,
		() => true,
		{ actorId: 'creature-owner', maxEntries: 3 },
	);
	await fsPromises.unlink(getCreatureSavePath(entityKey));

	await assert.rejects(
		createEntity(entityKey, 'character', 'character-owner'),
		error => error.code === 'EEXIST',
	);
	const undo = await undoEntity(entityKey, () => true, { maxEntries: 3 });
	assert.equal(undo.entity.type, 'creature');
	await deleteEntity(entityKey, () => true, 'creature');
});

test('creature updates serialize per key and preserve complete pre-change history', async () => {
	const entityKey = 'Creature.History';
	await createEntity(entityKey, 'creature', 'owner');
	await Promise.all([
		updateCreature(entityKey, () => true, creature => {
			creature.level += 1;
		}),
		updateCreature(entityKey, () => true, creature => {
			creature.level += 1;
		}),
	]);
	assert.equal((await getEntity(entityKey)).level, 3);

	await damageEntity(
		entityKey,
		5,
		false,
		() => true,
		{ actorId: 'owner', maxEntries: 3 },
	);
	await damageEntity(
		entityKey,
		2,
		false,
		() => true,
		{ actorId: 'owner', maxEntries: 1 },
	);
	const history = JSON.parse(await fsPromises.readFile(
		getCreatureHistoryPath(entityKey),
		'utf8',
	));
	assert.equal(history.type, 'creature');
	assert.equal(history.entries.length, 1);
	assert.equal(history.entries[0].creature.status.hp.current, 95);

	const undo = await undoEntity(entityKey, () => true, { maxEntries: 1 });
	assert.equal(undo.entity.type, 'creature');
	assert.equal(undo.entity.status.hp.current, 95);
	assert.equal(getEntityOperationQueueSize(), 0);
});

test('creature undo rejects snapshots that could change the concrete type', async () => {
	const entityKey = 'Creature.TypeGuard';
	await createEntity(entityKey, 'creature', 'owner');
	await damageEntity(
		entityKey,
		1,
		false,
		() => true,
		{ actorId: 'owner', maxEntries: 3 },
	);
	const historyPath = getCreatureHistoryPath(entityKey);
	const history = JSON.parse(await fsPromises.readFile(historyPath, 'utf8'));
	history.entries[0].creature.type = 'character';
	await fsPromises.writeFile(historyPath, JSON.stringify(history), 'utf8');
	await assert.rejects(
		undoEntity(entityKey, () => true, { maxEntries: 3 }),
		error => error.code === 'INVALID_CREATURE_HISTORY_SNAPSHOT',
	);
	assert.equal((await getEntity(entityKey)).type, 'creature');
});

test('permanent creature deletion removes active state and retained history', async () => {
	const entityKey = 'Creature.Delete';
	await createEntity(entityKey, 'creature', 'owner');
	await damageEntity(
		entityKey,
		1,
		false,
		() => true,
		{ actorId: 'owner', maxEntries: 3 },
	);
	await deleteEntity(entityKey, () => true, 'creature');
	await assert.rejects(fsPromises.access(getCreatureSavePath(entityKey)), {
		code: 'ENOENT',
	});
	await assert.rejects(fsPromises.access(getCreatureHistoryPath(entityKey)), {
		code: 'ENOENT',
	});
});

test('creature deletion reports rollback-safe creature transaction errors', async () => {
	let restored = false;
	await assert.rejects(
		commitPermanentDeletion({
			deleteEntity: async () => {
				throw new Error('active delete failed');
			},
			deleteHistory: async () => undefined,
			entityKey: 'Creature.Rollback',
			entityType: 'creature',
			restoreHistory: async () => {
				restored = true;
			},
		}),
		error => error.code === 'CREATURE_DELETION_PERSISTENCE_FAILED',
	);
	assert.equal(restored, true);
});

test('creature history and active-save failures roll back the first file operation', async () => {
	const entityKey = 'Creature.PersistenceRollback';
	const savePath = getCreatureSavePath(entityKey);
	const historyPath = getCreatureHistoryPath(entityKey);
	const displacedPath = `${savePath}.displaced`;
	await createEntity(entityKey, 'creature', 'owner');
	try {
		await assert.rejects(
			updateCreature(
				entityKey,
				() => true,
				async creature => {
					creature.level = 2;
					await fsPromises.rename(savePath, displacedPath);
					await fsPromises.mkdir(savePath);
				},
				{
					action: 'set',
					actorId: 'owner',
					maxEntries: 3,
				},
			),
			error => error.code === 'CREATURE_HISTORY_PERSISTENCE_FAILED',
		);
		await assert.rejects(fsPromises.access(historyPath), { code: 'ENOENT' });
	}
	finally {
		await fsPromises.rm(savePath, { recursive: true, force: true });
		await fsPromises.rename(displacedPath, savePath);
	}
	assert.equal((await getEntity(entityKey)).level, 1);
});

test('creature-store deletion restores history when active deletion fails', async () => {
	const entityKey = 'Creature.DeleteRollback';
	await createEntity(entityKey, 'creature', 'owner');
	await damageEntity(
		entityKey,
		1,
		false,
		() => true,
		{ actorId: 'owner', maxEntries: 3 },
	);
	const savePath = getCreatureSavePath(entityKey);
	const historyPath = getCreatureHistoryPath(entityKey);
	const saveBefore = await fsPromises.readFile(savePath, 'utf8');
	const historyBefore = await fsPromises.readFile(historyPath, 'utf8');
	const originalUnlink = fsPromises.unlink;
	fsPromises.unlink = async targetPath => {
		if (path.resolve(targetPath) === path.resolve(savePath)) {
			const error = new Error('controlled active deletion failure');
			error.code = 'EACCES';
			throw error;
		}
		return originalUnlink(targetPath);
	};
	try {
		await assert.rejects(
			deleteEntity(entityKey, () => true, 'creature'),
			error => error.code === 'CREATURE_DELETION_PERSISTENCE_FAILED',
		);
	}
	finally {
		fsPromises.unlink = originalUnlink;
	}
	assert.equal(await fsPromises.readFile(savePath, 'utf8'), saveBefore);
	assert.equal(await fsPromises.readFile(historyPath, 'utf8'), historyBefore);
});

test('creature ownership is rechecked inside mutation workflows', async () => {
	const entityKey = 'Creature.Authorization';
	await createEntity(entityKey, 'creature', 'owner');
	await assert.rejects(
		damageEntity(
			entityKey,
			4,
			false,
			() => false,
			{ actorId: 'intruder', maxEntries: 3 },
		),
		error => error.code === 'NOT_CREATURE_EDITOR',
	);
	assert.equal((await getEntity(entityKey)).status.hp.current, 100);
});

test('character and creature field orders stay explicit and type-compatible', async () => {
	assert.deepEqual(getCharacterSections().map(field => field.id), [
		'name',
		'level',
		'status',
		'statistics',
		'rules',
		'talents',
		'gear',
		'race',
		'background',
		'personality',
		'modifiers',
	]);
	assert.deepEqual(getCreatureSections().map(field => field.id), [
		'identity',
		'level',
		'status',
		'statistics',
		'rules',
		'traits',
		'modifiers',
		'gear',
	]);

	const entityKey = 'Creature.Fields';
	await createEntity(entityKey, 'creature', 'owner');
	await updateEditableEntity(
		entityKey,
		'traits',
		'Keen Scent:Tracks across stone\n- Night Eyes:Sees in darkness',
		() => true,
		{ actorId: 'owner', maxEntries: 3 },
		'creature',
	);
	assert.deepEqual((await getEntity(entityKey)).traits, [
		{ name: 'Keen Scent', description: 'Tracks across stone' },
		{ name: 'Night Eyes', description: 'Sees in darkness' },
	]);
	const characterKey = 'Character.Modifiers';
	await createEntity(characterKey, 'character', 'owner');
	await updateEditableEntity(
		characterKey,
		'modifiers',
		'Scarred:Old wounds remain visible',
		() => true,
		{ actorId: 'owner', maxEntries: 3 },
		'character',
	);
	assert.deepEqual((await getEntity(characterKey)).modifiers, [
		{ name: 'Scarred', description: 'Old wounds remain visible' },
	]);
	await assert.rejects(
		updateEditableEntity(
			entityKey,
			'race',
			{},
			() => true,
			{ actorId: 'owner', maxEntries: 3 },
			'creature',
		),
		error => error.code === 'INVALID_CREATURE_EDIT',
	);

	const choices = await getEntitySectionChoices('', 'en', entityKey);
	assert.deepEqual(
		choices.map(choice => choice.value),
		getCreatureSections().map(field => field.id),
	);
});

test('combined entity listing and autocomplete include both concrete types', async () => {
	await createEntity('List.Character', 'character', 'owner');
	await createEntity('List.Creature', 'creature', 'owner');
	const choices = await getEntityChoices('List.', 'en');
	assert.deepEqual(
		new Set(choices.map(choice => choice.value)),
		new Set(['List.Character', 'List.Creature']),
	);
	assert.ok(choices.some(choice => choice.name.includes('Character')));
	assert.ok(choices.some(choice => choice.name.includes('Creature')));
});

test('management metadata is entity-neutral while generators use concrete save keys', () => {
	const managementCommands = [
		'add',
		'get',
		'set',
		'damage',
		'heal',
		'end-turn',
		'delete',
		'undo',
	];
	for (const commandId of managementCommands) {
		const command = COMMAND_METADATA.find(metadata => metadata.id === commandId);
		assert.equal(command.options[0].name, 'entity-key', commandId);
	}
	const addType = COMMAND_METADATA
		.find(metadata => metadata.id === 'add')
		.options.find(option => option.name === 'type');
	assert.deepEqual(addType.choices.map(choice => choice.value), [
		'character',
		'creature',
	]);
	assert.equal(
		COMMAND_METADATA.find(metadata => metadata.id === 'gen-char').options[0].name,
		'character-key',
	);
	const creatureGenerator = COMMAND_METADATA.find(
		metadata => metadata.id === 'gen-monster',
	);
	assert.equal(creatureGenerator.options[0].name, 'creature-key');
	assert.deepEqual(
		creatureGenerator.options.find(option => option.name === 'type')
			.choices.map(choice => choice.value),
		['monster', 'animal', 'companion'],
	);
});

test('registered management handlers create, mutate, and display creatures', async () => {
	const entityKey = 'Handlers.Creature';
	const config = { botUserId: 'bot', locale: 'en' };
	const baseInteraction = {
		guild: { ownerId: 'server-owner' },
		guildId: 'guild',
		member: { roles: { cache: { has: () => false } } },
		user: { id: 'handler-owner' },
	};
	let addReply;
	await commandRegistry.getRuntimeCommands().get('add').execute({
		config,
		interaction: {
			...baseInteraction,
			options: {
				getString: option => option === 'entity-key' ? entityKey : 'creature',
			},
			reply: async response => {
				addReply = response;
			},
		},
	});
	assert.match(addReply, /Creature.*Handlers\.Creature/);
	assert.equal((await getEntity(entityKey)).type, 'creature');

	let damageReply;
	await commandRegistry.getRuntimeCommands().get('damage').execute({
		config,
		interaction: {
			...baseInteraction,
			options: {
				getBoolean: () => false,
				getInteger: () => 7,
				getString: () => entityKey,
			},
			reply: async response => {
				damageReply = response;
			},
		},
	});
	assert.match(damageReply, /received \*\*7 damage\*\*/);
	assert.equal((await getEntity(entityKey)).status.hp.current, 93);

	let getReply;
	await commandRegistry.getRuntimeCommands().get('get').execute({
		config,
		interaction: {
			...baseInteraction,
			options: {
				getString: option => option === 'entity-key' ? entityKey : null,
			},
			reply: async response => {
				getReply = response;
			},
		},
	});
	assert.equal(getReply.embeds.length, 1);
	assert.equal(getReply.embeds[0].toJSON().title, entityKey);
	await deleteEntity(entityKey, () => true, 'creature');
});

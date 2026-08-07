const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');

const testSaveDirectory = fs.mkdtempSync(
	path.join(os.tmpdir(), 'incredible-bot-history-'),
);
process.env.INCREDIBLE_BOT_SAVE_DIRECTORY = testSaveDirectory;

const commandRegistry = require('../commands/registry');
const {
	damageEntity,
	endEntityTurn,
	healEntity,
	undoEntity,
	updateEditableEntity,
} = require('../services/entityApplicationService');
const {
	CHARACTER_HISTORY_ACTIONS,
	readCharacterHistory,
} = require('../services/characterHistoryStore');
const {
	commitHistoryThenMutation,
	commitMutationThenHistory,
} = require('../services/entityPersistenceTransaction');
const {
	createCharacter,
	getCharacter,
	undoCharacter,
	updateCharacter,
} = require('../services/characterStore');
const {
	characterHistoryDirectory,
	getCharacterHistoryPath,
	getCharacterSavePath,
} = require('../services/entityStoragePaths');
const { validateCharacterSaveSchema } = require('../services/characterSaveSchema');
const { writeJsonAtomically } = require('../services/atomicJsonFile');
const {
	createEntityUndoResponse,
} = require('../util/entityCommandResponses');
const {
	getEntityHistoryMaxEntries,
	reloadConfig,
	validateConfig,
} = require('../util/configuration');
const {
	handleEntityInteraction,
	openEntityEditor,
} = require('../commands/entity/interactions');

let keyCounter = 0;

after(() => {
	fs.rmSync(testSaveDirectory, { recursive: true, force: true });
});

test('entity history limit defaults to three and validates the retained configuration key', () => {
	const config = createConfig();
	assert.equal(getEntityHistoryMaxEntries(validateConfig(config)), 3);
	assert.equal(
		getEntityHistoryMaxEntries(validateConfig({
			...config,
			characterHistory: {},
		})),
		3,
	);
	assert.equal(
		getEntityHistoryMaxEntries(validateConfig({
			...config,
			characterHistory: { maxEntries: 7 },
		})),
		7,
	);

	for (const maxEntries of [0, -1, 1.5, '3', null, Number.NaN]) {
		assert.throws(
			() => validateConfig({
				...config,
				characterHistory: { maxEntries },
			}),
			error => (
				error.code === 'INVALID_CONFIGURATION'
				&& error.field === 'characterHistory.maxEntries'
			),
			String(maxEntries),
		);
	}
});

test('default and custom retention rotate the oldest snapshots first', async () => {
	const defaultKey = nextKey('Retention.Default');
	await createCharacter(defaultKey, 'creator');
	for (const value of ['A', 'B', 'C', 'D']) {
		await editFirstName(defaultKey, value, historyContext());
	}
	assert.deepEqual(
		(await readHistory(defaultKey)).entries.map(entry => entry.character.name.firstName),
		['A', 'B', 'C'],
	);

	const higherKey = nextKey('Retention.Higher');
	await createCharacter(higherKey, 'creator');
	for (const value of ['1', '2', '3', '4', '5', '6']) {
		await editFirstName(higherKey, value, historyContext(5));
	}
	assert.deepEqual(
		(await readHistory(higherKey)).entries.map(entry => entry.character.name.firstName),
		['1', '2', '3', '4', '5'],
	);

	const lowerKey = nextKey('Retention.Lower');
	await createCharacter(lowerKey, 'creator');
	for (const value of ['A', 'B', 'C', 'D']) {
		await editFirstName(lowerKey, value, historyContext(5));
	}
	await editFirstName(lowerKey, 'E', historyContext(2));
	assert.deepEqual(
		(await readHistory(lowerKey)).entries.map(entry => entry.character.name.firstName),
		['C', 'D'],
	);
});

test('a reloaded retention value affects later history operations', async () => {
	const characterKey = nextKey('Retention.Reload');
	const configPath = path.join(testSaveDirectory, 'reload-config.json');
	let activeConfig = createConfig();
	const runtimeState = {
		getConfig: () => activeConfig,
		replaceConfig: replacement => {
			activeConfig = replacement;
		},
	};
	await createCharacter(characterKey, 'creator');
	await editFirstName(
		characterKey,
		'A',
		historyContext(getEntityHistoryMaxEntries(runtimeState.getConfig())),
	);

	await fsPromises.writeFile(
		configPath,
		JSON.stringify(createConfig(1)),
		'utf8',
	);
	reloadConfig(runtimeState, configPath);
	await editFirstName(
		characterKey,
		'B',
		historyContext(getEntityHistoryMaxEntries(runtimeState.getConfig())),
	);

	const history = await readHistory(characterKey);
	assert.equal(history.entries.length, 1);
	assert.equal(history.entries[0].character.name.firstName, 'A');
});

test('every supported successful action stores a complete pre-change snapshot', async () => {
	const characterKey = nextKey('Actions');
	const context = historyContext(10, 'all-actions-actor');
	await createCharacter(characterKey, 'creator');
	await updateEditableEntity(
		characterKey,
		'name',
		{ firstName: 'History', lastName: '' },
		() => true,
		context,
	);
	await damageEntity(characterKey, 10, false, () => true, context);
	await healEntity(characterKey, 'hp', 100, () => true, context);
	await endEntityTurn(characterKey, () => true, context);

	const history = await readHistory(characterKey);
	assert.deepEqual(
		history.entries.map(entry => entry.action),
		['set', 'damage', 'heal', 'end-turn'],
	);
	for (const entry of history.entries) {
		assert.equal(entry.actorId, 'all-actions-actor');
		assert.ok(Number.isFinite(Date.parse(entry.createdAt)));
		assert.equal(validateCharacterSaveSchema(entry.character), entry.character);
		assert.ok(entry.character.status);
		assert.ok(entry.character.statistics);
	}
	assert.equal((await getCharacter(characterKey)).key, characterKey);
});

test('/set creates history only after a successful modal submission', async () => {
	const characterKey = nextKey('Modal.Set');
	const user = { id: 'modal-creator' };
	const config = createConfig();
	await createCharacter(characterKey, user.id);
	let modal;
	await openEntityEditor({
		guildId: 'guild',
		member: { roles: [] },
		showModal: async value => {
			modal = value.toJSON();
		},
		user,
	}, config, characterKey, 'name');

	let response;
	await handleEntityInteraction({
		customId: modal.custom_id,
		fields: {
			getTextInputValue: customId => (
				customId === 'field-name-first-name' ? 'Modal value' : ''
			),
		},
		guildId: 'guild',
		isModalSubmit: () => true,
		member: { roles: [] },
		reply: async value => {
			response = value;
		},
		user,
	}, config);

	assert.equal((await getCharacter(characterKey)).name.firstName, 'Modal value');
	const history = await readHistory(characterKey);
	assert.equal(history.entries.length, 1);
	assert.equal(history.entries[0].action, 'set');
	assert.equal(history.entries[0].actorId, user.id);
	assert.equal(history.entries[0].character.name.firstName, '');
	assert.ok(response.flags);
});

test('authorization, validation, and serialization failures do not add history', async () => {
	const authorizationKey = nextKey('Failure.Authorization');
	await createCharacter(authorizationKey, 'creator');
	await assert.rejects(
		editFirstName(
			authorizationKey,
			'Rejected',
			historyContext(),
			() => false,
		),
		{ code: 'NOT_CHARACTER_EDITOR' },
	);
	assert.equal(await historyExists(authorizationKey), false);

	const validationKey = nextKey('Failure.Validation');
	await createCharacter(validationKey, 'creator');
	await assert.rejects(
		updateEditableEntity(
			validationKey,
			'statistics',
			[
				'constitution: 10',
				'strength: not-a-number',
				'dexterity: 10',
				'intelligence: 10',
				'speed: 10',
				'perception: 10',
				'charisma: 10',
				'initiative: 10',
				'reflexes: 10',
			].join('\n'),
			() => true,
			historyContext(),
		),
		{ code: 'INVALID_CHARACTER_EDIT' },
	);
	assert.equal(await historyExists(validationKey), false);

	const serializationKey = nextKey('Failure.Serialization');
	await createCharacter(serializationKey, 'creator');
	await assert.rejects(
		updateCharacter(
			serializationKey,
			() => true,
			character => {
				character.circular = character;
			},
			{
				...historyContext(),
				action: 'set',
			},
		),
		TypeError,
	);
	assert.equal(await historyExists(serializationKey), false);
	assert.equal((await getCharacter(serializationKey)).name.firstName, '');
});

test('an active-save persistence failure rolls back its newly written history', async () => {
	const characterKey = nextKey('Failure.ActiveWrite');
	const savePath = getCharacterSavePath(characterKey);
	const displacedPath = `${savePath}.displaced`;
	await createCharacter(characterKey, 'creator');

	try {
		await assert.rejects(
			updateCharacter(
				characterKey,
				() => true,
				async character => {
					character.name.firstName = 'Must roll back';
					await fsPromises.rename(savePath, displacedPath);
					await fsPromises.mkdir(savePath);
				},
				{
					...historyContext(),
					action: 'set',
				},
			),
			{ code: 'CHARACTER_HISTORY_PERSISTENCE_FAILED' },
		);
		assert.equal(await historyExists(characterKey), false);
		assert.deepEqual(await listHistoryTemporaryFiles(), []);
	}
	finally {
		await fsPromises.rm(savePath, { recursive: true, force: true });
		if (await pathExists(displacedPath)) {
			await fsPromises.rename(displacedPath, savePath);
		}
	}
	assert.equal((await getCharacter(characterKey)).name.firstName, '');
});

test('different characters keep independent histories', async () => {
	const firstKey = nextKey('Independent.First');
	const secondKey = nextKey('Independent.Second');
	await Promise.all([
		createCharacter(firstKey, 'creator'),
		createCharacter(secondKey, 'creator'),
	]);
	await editFirstName(firstKey, 'First', historyContext(3, 'first-actor'));
	await editFirstName(secondKey, 'Second', historyContext(3, 'second-actor'));

	assert.deepEqual(
		(await readHistory(firstKey)).entries.map(entry => entry.actorId),
		['first-actor'],
	);
	assert.deepEqual(
		(await readHistory(secondKey)).entries.map(entry => entry.actorId),
		['second-actor'],
	);
});

test('concurrent mutations preserve history ordering inside the per-key queue', async () => {
	const characterKey = nextKey('Concurrent');
	const firstStarted = createDeferred();
	const releaseFirst = createDeferred();
	await createCharacter(characterKey, 'creator');

	const first = updateCharacter(
		characterKey,
		() => true,
		async character => {
			character.name.firstName = 'First';
			firstStarted.resolve();
			await releaseFirst.promise;
		},
		{
			...historyContext(5, 'first-actor'),
			action: 'set',
		},
	);
	await firstStarted.promise;
	const second = updateCharacter(
		characterKey,
		() => true,
		character => {
			character.name.lastName = 'Second';
		},
		{
			...historyContext(5, 'second-actor'),
			action: 'set',
		},
	);

	releaseFirst.resolve();
	await Promise.all([first, second]);
	const history = await readHistory(characterKey);
	assert.deepEqual(
		history.entries.map(entry => entry.actorId),
		['first-actor', 'second-actor'],
	);
	assert.equal(history.entries[0].character.name.firstName, '');
	assert.equal(history.entries[1].character.name.firstName, 'First');
});

test('history writes are atomic and clean temporary files after a partial write', async () => {
	await fsPromises.mkdir(characterHistoryDirectory, { recursive: true });
	const destinationPath = path.join(
		characterHistoryDirectory,
		'Atomic.Failure.json',
	);
	const writeError = new Error('controlled history write failure');
	const failingFileSystem = {
		link: fsPromises.link,
		mkdir: fsPromises.mkdir,
		open: async (...arguments_) => {
			const handle = await fsPromises.open(...arguments_);
			return {
				close: () => handle.close(),
				writeFile: async data => {
					await handle.writeFile(data.slice(0, 8), 'utf8');
					throw writeError;
				},
			};
		},
		rename: fsPromises.rename,
		unlink: fsPromises.unlink,
	};

	await assert.rejects(
		writeJsonAtomically(
			destinationPath,
			{ entries: [] },
			{ fileSystem: failingFileSystem, uniqueId: () => 'history-test' },
		),
		error => error === writeError,
	);
	assert.deepEqual(await listHistoryTemporaryFiles(), []);
	assert.equal(await pathExists(destinationPath), false);
});

test('two-file persistence rolls back the first completed operation', async () => {
	const normalState = { active: 'before', history: 'before' };
	await assert.rejects(
		commitHistoryThenMutation({
			entityKey: 'Rollback.Normal',
			commitMutation: async () => {
				throw new Error('active write failed');
			},
			rollbackHistory: async () => {
				normalState.history = 'before';
			},
			writeHistory: async () => {
				normalState.history = 'after';
			},
		}),
		{ code: 'CHARACTER_HISTORY_PERSISTENCE_FAILED' },
	);
	assert.deepEqual(normalState, { active: 'before', history: 'before' });

	const undoState = { active: 'before', history: 'before' };
	await assert.rejects(
		commitMutationThenHistory({
			entityKey: 'Rollback.Undo',
			commitMutation: async () => {
				undoState.active = 'after';
			},
			rollbackMutation: async () => {
				undoState.active = 'before';
			},
			writeHistory: async () => {
				throw new Error('history write failed');
			},
		}),
		{ code: 'CHARACTER_HISTORY_PERSISTENCE_FAILED' },
	);
	assert.deepEqual(undoState, { active: 'before', history: 'before' });
});

test('unrecoverable rollback failures are logged and use a stable error code', async () => {
	const logged = [];
	await assert.rejects(
		commitHistoryThenMutation({
			entityKey: 'Rollback.Unrecoverable',
			commitMutation: async () => {
				throw new Error('active write failed');
			},
			logger: {
				error: (...parts) => logged.push(parts),
			},
			rollbackHistory: async () => {
				throw new Error('history rollback failed');
			},
			writeHistory: async () => undefined,
		}),
		{ code: 'CHARACTER_HISTORY_CONSISTENCY_FAILED' },
	);
	assert.equal(logged.length, 1);
	assert.match(logged[0][0], /Rollback\.Unrecoverable/);
});

test('three default undos walk backward without toggling or creating redo state', async () => {
	const characterKey = nextKey('Undo.Stack');
	const context = historyContext(3, 'stack-actor');
	await createCharacter(characterKey, 'creator');
	for (const value of ['A', 'B', 'C', 'D']) {
		await editFirstName(characterKey, value, context);
	}

	const restoredValues = [];
	for (let index = 0; index < 3; index += 1) {
		const result = await undoEntity(
			characterKey,
			() => true,
			context,
		);
		restoredValues.push(result.entity.name.firstName);
		assert.equal(result.action, 'set');
		assert.equal(result.actorId, 'stack-actor');
	}
	assert.deepEqual(restoredValues, ['C', 'B', 'A']);
	assert.equal((await readHistory(characterKey)).entries.length, 0);
	await assert.rejects(
		undoEntity(characterKey, () => true, context),
		{ code: 'NO_CHARACTER_HISTORY' },
	);
	assert.equal((await getCharacter(characterKey)).name.firstName, 'A');
});

test('the concrete character undo result uses the shared entity shape', async () => {
	const characterKey = nextKey('Undo.ConcreteShape');
	await createCharacter(characterKey, 'creator');
	await updateCharacter(
		characterKey,
		() => true,
		character => {
			character.name.firstName = 'Changed';
		},
		{
			action: 'set',
			actorId: 'creator',
			createdAt: '2026-08-06T10:00:00.000Z',
			maxEntries: 3,
		},
	);

	const result = await undoCharacter(characterKey, () => true, { maxEntries: 3 });
	assert.deepEqual(Object.keys(result), ['entity', 'action', 'actorId', 'createdAt']);
	assert.equal(result.entity.key, characterKey);
	assert.equal(result.entity.name.firstName, '');
	assert.equal(result.action, 'set');
	assert.equal(result.actorId, 'creator');
	assert.equal(result.createdAt, '2026-08-06T10:00:00.000Z');
});

test('version-1 and version-2 snapshots coexist and undo always writes version 2', async () => {
	const characterKey = nextKey('Undo.MixedSchema');
	const context = historyContext(3, 'migration-actor');
	await fsPromises.writeFile(
		getCharacterSavePath(characterKey),
		JSON.stringify({
			schemaVersion: 1,
			key: characterKey,
			creatorId: 'creator',
			firstName: 'Legacy',
			lastName: 'Name',
		}, null, 2),
		'utf8',
	);

	await editFirstName(characterKey, 'First v2', context);
	await editFirstName(characterKey, 'Second v2', context);
	let history = await readHistory(characterKey);
	assert.deepEqual(
		history.entries.map(entry => entry.character.schemaVersion),
		[1, 2],
	);
	assert.equal(history.entries[0].character.firstName, 'Legacy');
	assert.equal(history.entries[1].character.name.firstName, 'First v2');

	const firstUndo = await undoEntity(characterKey, () => true, context);
	assert.equal(firstUndo.entity.name.firstName, 'First v2');
	assert.equal((await readRawSave(characterKey)).schemaVersion, 2);
	const migratedUndo = await undoEntity(characterKey, () => true, context);
	assert.equal(migratedUndo.entity.name.firstName, 'Legacy');
	const migratedSave = await readRawSave(characterKey);
	assert.equal(migratedSave.schemaVersion, 2);
	assert.deepEqual(migratedSave.name, {
		firstName: 'Legacy',
		lastName: 'Name',
	});
	assert.equal(Object.hasOwn(migratedSave, 'firstName'), false);
	history = await readHistory(characterKey);
	assert.equal(history.entries.length, 0);
});

test('undo rejects missing history and preserves state on permission failure', async () => {
	const noHistoryKey = nextKey('Undo.Empty');
	await createCharacter(noHistoryKey, 'creator');
	await assert.rejects(
		undoEntity(noHistoryKey, () => true, historyContext()),
		{ code: 'NO_CHARACTER_HISTORY' },
	);

	const deniedKey = nextKey('Undo.Denied');
	await createCharacter(deniedKey, 'creator');
	await editFirstName(deniedKey, 'Current', historyContext());
	const historyBefore = await readHistory(deniedKey);
	await assert.rejects(
		undoEntity(deniedKey, () => false, historyContext()),
		{ code: 'NOT_CHARACTER_EDITOR' },
	);
	assert.equal((await getCharacter(deniedKey)).name.firstName, 'Current');
	assert.deepEqual(await readHistory(deniedKey), historyBefore);
});

test('new history contexts exclude delete while legacy delete entries remain readable', async () => {
	assert.deepEqual(
		[...CHARACTER_HISTORY_ACTIONS],
		['set', 'damage', 'heal', 'end-turn'],
	);
	const characterKey = nextKey('History.LegacyDelete');
	const context = historyContext();
	await createCharacter(characterKey, 'creator');
	await editFirstName(characterKey, 'Legacy', context);
	const legacyDocument = await readHistory(characterKey);
	legacyDocument.entries[0].action = 'delete';
	await fsPromises.writeFile(
		getCharacterHistoryPath(characterKey),
		JSON.stringify(legacyDocument, null, 2),
		'utf8',
	);
	const historyState = await readCharacterHistory(characterKey);
	assert.equal(historyState.document.entries[0].action, 'delete');
});

test('undo rejects invalid and unsupported snapshot schema versions', async () => {
	const characterKey = nextKey('Undo.Schema');
	const context = historyContext();
	await createCharacter(characterKey, 'creator');
	await editFirstName(characterKey, 'Current', context);
	const historyPath = getCharacterHistoryPath(characterKey);
	const invalidHistory = await readHistory(characterKey);
	delete invalidHistory.entries.at(-1).character.schemaVersion;
	await fsPromises.writeFile(
		historyPath,
		JSON.stringify(invalidHistory, null, 2),
		'utf8',
	);
	await assert.rejects(
		undoEntity(characterKey, () => true, context),
		{ code: 'INVALID_CHARACTER_HISTORY_SNAPSHOT' },
	);
	assert.equal((await getCharacter(characterKey)).name.firstName, 'Current');

	invalidHistory.entries.at(-1).character.schemaVersion = 999;
	await fsPromises.writeFile(
		historyPath,
		JSON.stringify(invalidHistory, null, 2),
		'utf8',
	);
	await assert.rejects(
		undoEntity(characterKey, () => true, context),
		{ code: 'UNSUPPORTED_CHARACTER_HISTORY_SCHEMA' },
	);
	assert.equal((await readHistory(characterKey)).entries.length, 1);
	await fsPromises.rm(historyPath);
});

test('/undo autocomplete includes authorized active characters with history only', async () => {
	const userId = 'autocomplete-user';
	const activeKey = nextKey('Autocomplete.Active');
	const privateKey = nextKey('Autocomplete.Private');
	await createCharacter(activeKey, userId);
	await editFirstName(activeKey, 'Active', historyContext(3, userId));
	await createCharacter(privateKey, 'other-user');
	await editFirstName(privateKey, 'Private', historyContext(3, 'other-user'));

	const choices = await autocompleteUndo(createInteraction(userId), createConfig());
	const values = choices.map(choice => choice.value);
	assert.ok(values.includes(activeKey));
	assert.equal(values.includes(privateKey), false);
	assert.ok(choices.length <= 25);

	const dmValues = (
		await autocompleteUndo(
			createInteraction('dm-user', ['dm-role']),
			createConfig(),
		)
	).map(choice => choice.value);
	assert.ok(dmValues.includes(privateKey));
	const ownerValues = (
		await autocompleteUndo(
			createInteraction('owner', [], 'owner'),
			createConfig(),
		)
	).map(choice => choice.value);
	assert.ok(ownerValues.includes(privateKey));
});

test('undo response construction localizes action, timestamp, and actor', () => {
	const result = {
		action: 'set',
		actorId: '123456',
		entity: { key: 'Localized.Character' },
		createdAt: '2026-07-29T10:15:00.000Z',
	};
	const english = createEntityUndoResponse(result, 'en');
	const french = createEntityUndoResponse(result, 'fr');
	for (const response of [english, french]) {
		assert.match(response, /Localized\.Character/);
		assert.match(response, /<@123456>/);
		assert.match(response, /<t:\d+:F>/);
	}
	assert.match(english, /field edit/);
	assert.match(french, /modification de champ/);
});

test('/undo is registered, routed, permission-filtered, and documented centrally', async () => {
	const metadata = commandRegistry.getCommand('undo');
	assert.equal(metadata.permission, 'everyone');
	assert.equal(metadata.handler, './handlers/undo');
	assert.equal(
		commandRegistry.getAutocompleteMetadata('undo', 'entity-key')
			.autocomplete.provider,
		'undoable-entities',
	);
	assert.ok(commandRegistry.getHelpMetadata('rpg').includes(metadata));
	const registered = commandRegistry.getDiscordCommandData()
		.map(command => command.toJSON())
		.find(command => command.name === 'undo');
	assert.deepEqual(
		registered.options.map(option => ({
			autocomplete: option.autocomplete,
			name: option.name,
			required: option.required,
		})),
		[{
			autocomplete: true,
			name: 'entity-key',
			required: true,
		}],
	);

	let response;
	const interaction = {
		...createInteraction('routing-user'),
		options: {
			getString: () => nextKey('Routing.Empty'),
		},
		reply: async value => {
			response = value;
		},
	};
	await commandRegistry.getRuntimeCommands().get('undo').execute({
		config: createConfig(),
		interaction,
	});
	assert.match(response.content, /entity does not exist/i);
	assert.ok(response.flags);
});

async function editFirstName(
	characterKey,
	value,
	context,
	canManage = () => true,
) {
	return updateEditableEntity(
		characterKey,
		'name',
		{ firstName: value, lastName: '' },
		canManage,
		context,
	);
}

async function readRawSave(characterKey) {
	return JSON.parse(await fsPromises.readFile(
		getCharacterSavePath(characterKey),
		'utf8',
	));
}

function historyContext(maxEntries = 3, actorId = 'history-actor') {
	return { actorId, maxEntries };
}

function createConfig(maxEntries) {
	return {
		botUserId: 'bot',
		discordToken: 'test-token',
		locale: 'en',
		roles: {
			dm: 'dm-role',
			moderator: 'moderator-role',
		},
		...(maxEntries === undefined
			? {}
			: { characterHistory: { maxEntries } }),
	};
}

function createInteraction(userId, roleIds = [], ownerId = 'owner') {
	return {
		guild: { ownerId },
		guildId: 'guild',
		member: {
			roles: {
				cache: {
					has: roleId => roleIds.includes(roleId),
				},
			},
		},
		user: { id: userId },
	};
}

async function autocompleteUndo(interaction, config) {
	let choices;
	interaction.options = {
		getFocused: () => ({ name: 'entity-key', value: '' }),
	};
	interaction.respond = async value => {
		choices = value;
	};
	await commandRegistry.getRuntimeCommands().get('undo').autocomplete({
		config,
		interaction,
	});
	return choices;
}

async function readHistory(characterKey) {
	return JSON.parse(
		await fsPromises.readFile(getCharacterHistoryPath(characterKey), 'utf8'),
	);
}

async function historyExists(characterKey) {
	return pathExists(getCharacterHistoryPath(characterKey));
}

async function pathExists(filePath) {
	try {
		await fsPromises.access(filePath);
		return true;
	}
	catch (error) {
		if (error.code === 'ENOENT') {
			return false;
		}
		throw error;
	}
}

async function listHistoryTemporaryFiles() {
	return (await fsPromises.readdir(characterHistoryDirectory))
		.filter(fileName => fileName.endsWith('.tmp'));
}

function nextKey(prefix) {
	keyCounter += 1;
	return `${prefix}.${keyCounter}`;
}

function createDeferred() {
	let resolve;
	const promise = new Promise(resolvePromise => {
		resolve = resolvePromise;
	});
	return { promise, resolve };
}

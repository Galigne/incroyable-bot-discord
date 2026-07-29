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
	damageCharacter,
	deleteCharacter,
	endCharacterTurn,
	healCharacter,
	undoCharacter,
	updateEditableCharacter,
} = require('../services/characterApplicationService');
const {
	commitHistoryThenMutation,
	commitMutationThenHistory,
} = require('../services/characterPersistenceTransaction');
const {
	createCharacter,
	getCharacter,
	updateCharacter,
} = require('../services/characterStore');
const {
	characterHistoryDirectory,
	getCharacterHistoryPath,
	getCharacterSavePath,
} = require('../services/characterStoragePaths');
const { validateCharacterSaveSchema } = require('../services/characterSaveSchema');
const { writeJsonAtomically } = require('../services/atomicJsonFile');
const {
	createCharacterUndoResponse,
} = require('../util/characterCommandResponses');
const {
	getCharacterHistoryMaxEntries,
	reloadConfig,
	validateConfig,
} = require('../util/configuration');
const {
	handleRpgInteraction,
	openCharacterEditor,
} = require('../commands/rpg/interactions');

let keyCounter = 0;

after(() => {
	fs.rmSync(testSaveDirectory, { recursive: true, force: true });
});

test('character history configuration defaults to three and rejects invalid limits', () => {
	const config = createConfig();
	assert.equal(getCharacterHistoryMaxEntries(validateConfig(config)), 3);
	assert.equal(
		getCharacterHistoryMaxEntries(validateConfig({
			...config,
			characterHistory: {},
		})),
		3,
	);
	assert.equal(
		getCharacterHistoryMaxEntries(validateConfig({
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
		(await readHistory(defaultKey)).entries.map(entry => entry.character.firstName),
		['A', 'B', 'C'],
	);

	const higherKey = nextKey('Retention.Higher');
	await createCharacter(higherKey, 'creator');
	for (const value of ['1', '2', '3', '4', '5', '6']) {
		await editFirstName(higherKey, value, historyContext(5));
	}
	assert.deepEqual(
		(await readHistory(higherKey)).entries.map(entry => entry.character.firstName),
		['1', '2', '3', '4', '5'],
	);

	const lowerKey = nextKey('Retention.Lower');
	await createCharacter(lowerKey, 'creator');
	for (const value of ['A', 'B', 'C', 'D']) {
		await editFirstName(lowerKey, value, historyContext(5));
	}
	await editFirstName(lowerKey, 'E', historyContext(2));
	assert.deepEqual(
		(await readHistory(lowerKey)).entries.map(entry => entry.character.firstName),
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
		historyContext(getCharacterHistoryMaxEntries(runtimeState.getConfig())),
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
		historyContext(getCharacterHistoryMaxEntries(runtimeState.getConfig())),
	);

	const history = await readHistory(characterKey);
	assert.equal(history.entries.length, 1);
	assert.equal(history.entries[0].character.firstName, 'A');
});

test('every supported successful action stores a complete pre-change snapshot', async () => {
	const characterKey = nextKey('Actions');
	const context = historyContext(10, 'all-actions-actor');
	await createCharacter(characterKey, 'creator');
	await updateEditableCharacter(
		characterKey,
		'firstName',
		'History',
		() => true,
		context,
	);
	await damageCharacter(characterKey, 10, false, () => true, context);
	await healCharacter(characterKey, 'hp', 100, () => true, context);
	await endCharacterTurn(characterKey, () => true, context);
	await deleteCharacter(characterKey, () => true, context);

	const history = await readHistory(characterKey);
	assert.deepEqual(
		history.entries.map(entry => entry.action),
		['set', 'damage', 'heal', 'end-turn', 'delete'],
	);
	for (const entry of history.entries) {
		assert.equal(entry.actorId, 'all-actions-actor');
		assert.ok(Number.isFinite(Date.parse(entry.createdAt)));
		assert.equal(validateCharacterSaveSchema(entry.character), entry.character);
		assert.ok(entry.character.resources);
		assert.ok(entry.character.stats);
	}
	await assert.rejects(getCharacter(characterKey), { code: 'ENOENT' });
});

test('/set creates history only after a successful modal submission', async () => {
	const characterKey = nextKey('Modal.Set');
	const user = { id: 'modal-creator' };
	const config = createConfig();
	await createCharacter(characterKey, user.id);
	let modal;
	await openCharacterEditor({
		guildId: 'guild',
		member: { roles: [] },
		showModal: async value => {
			modal = value.toJSON();
		},
		user,
	}, config, characterKey, 'firstName');

	let response;
	await handleRpgInteraction({
		customId: modal.custom_id,
		fields: {
			getTextInputValue: () => 'Modal value',
		},
		guildId: 'guild',
		isModalSubmit: () => true,
		member: { roles: [] },
		reply: async value => {
			response = value;
		},
		user,
	}, config);

	assert.equal((await getCharacter(characterKey)).firstName, 'Modal value');
	const history = await readHistory(characterKey);
	assert.equal(history.entries.length, 1);
	assert.equal(history.entries[0].action, 'set');
	assert.equal(history.entries[0].actorId, user.id);
	assert.equal(history.entries[0].character.firstName, '');
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
		updateEditableCharacter(
			validationKey,
			'stats.strength',
			'not-a-number',
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
	assert.equal((await getCharacter(serializationKey)).firstName, '');
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
					character.firstName = 'Must roll back';
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
	assert.equal((await getCharacter(characterKey)).firstName, '');
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
			character.firstName = 'First';
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
			character.lastName = 'Second';
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
	assert.equal(history.entries[0].character.firstName, '');
	assert.equal(history.entries[1].character.firstName, 'First');
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
			characterKey: 'Rollback.Normal',
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
			characterKey: 'Rollback.Undo',
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
			characterKey: 'Rollback.Unrecoverable',
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
		const result = await undoCharacter(
			characterKey,
			() => true,
			context,
		);
		restoredValues.push(result.character.firstName);
		assert.equal(result.action, 'set');
		assert.equal(result.actorId, 'stack-actor');
	}
	assert.deepEqual(restoredValues, ['C', 'B', 'A']);
	assert.equal((await readHistory(characterKey)).entries.length, 0);
	await assert.rejects(
		undoCharacter(characterKey, () => true, context),
		{ code: 'NO_CHARACTER_HISTORY' },
	);
	assert.equal((await getCharacter(characterKey)).firstName, 'A');
});

test('undo rejects missing history and preserves state on permission failure', async () => {
	const noHistoryKey = nextKey('Undo.Empty');
	await createCharacter(noHistoryKey, 'creator');
	await assert.rejects(
		undoCharacter(noHistoryKey, () => true, historyContext()),
		{ code: 'NO_CHARACTER_HISTORY' },
	);

	const deniedKey = nextKey('Undo.Denied');
	await createCharacter(deniedKey, 'creator');
	await editFirstName(deniedKey, 'Current', historyContext());
	const historyBefore = await readHistory(deniedKey);
	await assert.rejects(
		undoCharacter(deniedKey, () => false, historyContext()),
		{ code: 'NOT_CHARACTER_EDITOR' },
	);
	assert.equal((await getCharacter(deniedKey)).firstName, 'Current');
	assert.deepEqual(await readHistory(deniedKey), historyBefore);
});

test('undo restores a deleted character and authorizes from its snapshot', async () => {
	const characterKey = nextKey('Undo.Deleted');
	const context = historyContext(3, 'deleting-actor');
	await createCharacter(characterKey, 'creator');
	await editFirstName(characterKey, 'Restored', context);
	await deleteCharacter(characterKey, () => true, context);
	await assert.rejects(getCharacter(characterKey), { code: 'ENOENT' });

	await assert.rejects(
		undoCharacter(characterKey, () => false, context),
		{ code: 'NOT_CHARACTER_EDITOR' },
	);
	await assert.rejects(getCharacter(characterKey), { code: 'ENOENT' });

	const result = await undoCharacter(
		characterKey,
		character => character.creatorId === 'creator',
		context,
	);
	assert.equal(result.action, 'delete');
	assert.equal(result.character.firstName, 'Restored');
	assert.equal((await getCharacter(characterKey)).firstName, 'Restored');
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
		undoCharacter(characterKey, () => true, context),
		{ code: 'INVALID_CHARACTER_HISTORY_SNAPSHOT' },
	);
	assert.equal((await getCharacter(characterKey)).firstName, 'Current');

	invalidHistory.entries.at(-1).character.schemaVersion = 999;
	await fsPromises.writeFile(
		historyPath,
		JSON.stringify(invalidHistory, null, 2),
		'utf8',
	);
	await assert.rejects(
		undoCharacter(characterKey, () => true, context),
		{ code: 'UNSUPPORTED_CHARACTER_HISTORY_SCHEMA' },
	);
	assert.equal((await readHistory(characterKey)).entries.length, 1);
	await fsPromises.rm(historyPath);
});

test('/undo autocomplete includes authorized active and deleted characters only', async () => {
	const userId = 'autocomplete-user';
	const activeKey = nextKey('Autocomplete.Active');
	const deletedKey = nextKey('Autocomplete.Deleted');
	const privateKey = nextKey('Autocomplete.Private');
	await createCharacter(activeKey, userId);
	await editFirstName(activeKey, 'Active', historyContext(3, userId));
	await createCharacter(deletedKey, userId);
	await deleteCharacter(
		deletedKey,
		() => true,
		historyContext(3, userId),
	);
	await createCharacter(privateKey, 'other-user');
	await editFirstName(privateKey, 'Private', historyContext(3, 'other-user'));

	const choices = await autocompleteUndo(createInteraction(userId), createConfig());
	const values = choices.map(choice => choice.value);
	assert.ok(values.includes(activeKey));
	assert.ok(values.includes(deletedKey));
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
		character: { key: 'Localized.Character' },
		createdAt: '2026-07-29T10:15:00.000Z',
	};
	const english = createCharacterUndoResponse(result, 'en');
	const french = createCharacterUndoResponse(result, 'fr');
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
	assert.equal(metadata.handler, './rpg/subcommands/undo');
	assert.equal(
		commandRegistry.getAutocompleteMetadata('undo', 'character-key')
			.autocomplete.provider,
		'undoable-characters',
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
			name: 'character-key',
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
	assert.match(response.content, /No backup/);
	assert.ok(response.flags);
});

async function editFirstName(
	characterKey,
	value,
	context,
	canManage = () => true,
) {
	return updateEditableCharacter(
		characterKey,
		'firstName',
		value,
		canManage,
		context,
	);
}

function historyContext(maxEntries = 3, actorId = 'history-actor') {
	return { actorId, maxEntries };
}

function createConfig(maxEntries) {
	return {
		botUserId: 'bot',
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
		getFocused: () => ({ name: 'character-key', value: '' }),
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

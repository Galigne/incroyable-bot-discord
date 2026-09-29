const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');

const testSaveDirectory = fs.mkdtempSync(
	path.join(os.tmpdir(), 'incredible-bot-settings-'),
);
process.env.INCREDIBLE_BOT_SAVE_DIRECTORY = testSaveDirectory;

const commandRegistry = require('../commands/registry');
const {
	commitEntityRename,
} = require('../services/entityPersistenceTransaction');
const {
	createEntity,
	damageEntity,
	getEntity,
	getVisibleEntity,
	undoEntity,
	updateEntitySettings,
} = require('../services/entityApplicationService');
const {
	parseEntitySettingsSubmission,
	validateEntitySettings,
} = require('../services/entitySettings');
const {
	getCharacterHistoryPath,
	getCharacterSavePath,
	getCreatureSavePath,
} = require('../services/entityStoragePaths');
const {
	canManageEntity,
	canViewEntity,
	hasFullEntityAuthority,
} = require('../util/authorization');

const OWNER_ID = '123456789012345678';
const SECOND_OWNER_ID = '234567890123456789';
const PARTIAL_ID = '345678901234567890';
const OUTSIDER_ID = '456789012345678901';
const DM_ID = '567890123456789012';
const config = {
	botUserId: '999999999999999999',
	discordToken: 'test-token',
	characterHistory: { maxEntries: 3 },
	locale: 'en',
	roles: { dm: 'dm-role' },
};

after(() => {
	fs.rmSync(testSaveDirectory, { recursive: true, force: true });
});

test('Settings parsing replaces a unique owner/partial list and rejects invalid forms', () => {
	assert.deepEqual(parseEntitySettingsSubmission({
		'settings.key': 'Settings.Parsed',
		'settings.visibility': 'private',
		'settings.access': [
			`${OWNER_ID}:owner`,
			`${PARTIAL_ID}:partial`,
		].join('\n'),
	}), {
		key: 'Settings.Parsed',
		settings: {
			visibility: 'private',
			access: [
				{ userId: OWNER_ID, level: 'owner' },
				{ userId: PARTIAL_ID, level: 'partial' },
			],
		},
	});
	assert.deepEqual(parseEntitySettingsSubmission({
		'settings.key': 'Settings.Empty',
		'settings.visibility': 'public',
		'settings.access': '',
	}).settings.access, []);

	for (const [value, translationKey] of [
		[{
			'settings.key': 'Settings.Invalid.Visibility',
			'settings.visibility': 'hidden',
			'settings.access': '',
		}, 'errors.invalidVisibility'],
		[{
			'settings.key': 'Settings.Invalid.Level',
			'settings.visibility': 'private',
			'settings.access': `${OWNER_ID}:none`,
		}, 'errors.invalidSettingsAccessLevel'],
		[{
			'settings.key': 'Settings.Invalid.Id',
			'settings.visibility': 'private',
			'settings.access': 'not-a-user:owner',
		}, 'errors.invalidSettingsUserId'],
		[{
			'settings.key': 'Settings.Duplicate',
			'settings.visibility': 'private',
			'settings.access': `${OWNER_ID}:owner\n${OWNER_ID}:partial`,
		}, 'errors.duplicateSettingsUser'],
	]) {
		assert.throws(
			() => parseEntitySettingsSubmission(value),
			error => error.code === 'INVALID_ENTITY_SETTINGS'
				&& error.translationKey === translationKey,
		);
	}
	assert.throws(() => validateEntitySettings({
		visibility: 'public',
		access: [{ userId: OWNER_ID, level: 'none' }],
	}));
});

test('full-authority Settings changes replace access while partial users retain ordinary control', async () => {
	const entityKey = 'Settings.Authority';
	await createEntity(entityKey, OWNER_ID, 'character');
	await updateEntitySettings(
		entityKey,
		settingsSubmission(entityKey, 'private', [
			{ userId: SECOND_OWNER_ID, level: 'owner' },
			{ userId: PARTIAL_ID, level: 'partial' },
		]),
		entity => hasFullEntityAuthority(createInteraction(OWNER_ID), entity, config),
		'character',
	);
	const entity = await getEntity(entityKey);
	assert.deepEqual(entity.settings.access, [
		{ userId: SECOND_OWNER_ID, level: 'owner' },
		{ userId: PARTIAL_ID, level: 'partial' },
	]);
	assert.equal(canManageEntity(createInteraction(PARTIAL_ID), entity, config), true);
	assert.equal(hasFullEntityAuthority(createInteraction(PARTIAL_ID), entity, config), false);

	await damageEntity(
		entityKey,
		5,
		false,
		current => canManageEntity(createInteraction(PARTIAL_ID), current, config),
		{ actorId: PARTIAL_ID, maxEntries: 3 },
	);
	await assert.rejects(
		updateEntitySettings(
			entityKey,
			settingsSubmission(entityKey, 'public', []),
			current => hasFullEntityAuthority(
				createInteraction(PARTIAL_ID),
				current,
				config,
			),
			'character',
		),
		{ code: 'NOT_ENTITY_OWNER' },
	);
	await updateEntitySettings(
		entityKey,
		settingsSubmission(entityKey, 'private', []),
		current => hasFullEntityAuthority(
			createInteraction(DM_ID, ['dm-role']),
			current,
			config,
		),
		'character',
	);
	assert.deepEqual((await getEntity(entityKey)).settings.access, []);
});

test('undo preserves the active key and complete current Settings', async () => {
	const entityKey = 'Settings.Undo';
	await createEntity(entityKey, OWNER_ID, 'character');
	await damageEntity(
		entityKey,
		10,
		false,
		() => true,
		{ actorId: OWNER_ID, maxEntries: 3 },
	);
	const settings = {
		visibility: 'private',
		access: [{ userId: PARTIAL_ID, level: 'partial' }],
	};
	await updateEntitySettings(
		entityKey,
		settingsSubmission(entityKey, settings.visibility, settings.access),
		() => true,
		'character',
	);
	const result = await undoEntity(entityKey, () => true, { maxEntries: 3 });
	assert.equal(result.entity.key, entityKey);
	assert.deepEqual(result.entity.settings, settings);
	assert.equal(result.entity.resources.hp.current, 100);
	assert.deepEqual((await getEntity(entityKey)).settings, settings);
});

test('visibility filters discovery and direct /get masks inaccessible private keys as missing', async () => {
	const publicKey = 'Visibility.Public';
	const privateKey = 'Visibility.Private';
	await createEntity(publicKey, OWNER_ID, 'character');
	await createEntity(privateKey, OWNER_ID, 'creature');
	await updateEntitySettings(
		privateKey,
		settingsSubmission(privateKey, 'private', [
			{ userId: PARTIAL_ID, level: 'partial' },
		]),
		() => true,
		'creature',
	);
	const outsider = createInteraction(OUTSIDER_ID);
	const partial = createInteraction(PARTIAL_ID);
	assert.equal(canViewEntity(outsider, await getEntity(publicKey), config), true);
	assert.equal(canViewEntity(outsider, await getEntity(privateKey), config), false);
	assert.equal(canViewEntity(partial, await getEntity(privateKey), config), true);
	await assert.rejects(
		getVisibleEntity(privateKey, entity => canViewEntity(outsider, entity, config)),
		{ code: 'ENOENT' },
	);

	const outsiderChoices = await autocomplete('get', outsider, 'entity-key', 'Visibility.');
	assert.deepEqual(outsiderChoices.map(choice => choice.value), [publicKey]);
	const partialChoices = await autocomplete('get', partial, 'entity-key', 'Visibility.');
	assert.deepEqual(
		new Set(partialChoices.map(choice => choice.value)),
		new Set([publicKey, privateKey]),
	);
	const fieldChoices = await autocomplete(
		'get',
		outsider,
		'field',
		'',
		privateKey,
	);
	assert.deepEqual(fieldChoices, []);

	const interaction = createCommandInteraction(OUTSIDER_ID, privateKey);
	await commandRegistry.getRuntimeCommands().get('get').execute({
		config,
		interaction,
	});
	assert.match(interaction.response.content, /does not exist/i);
});

test('Settings autocomplete is hidden from partial users and available to full authority', async () => {
	const entityKey = 'Settings.Autocomplete';
	await createEntity(entityKey, OWNER_ID, 'character');
	await updateEntitySettings(
		entityKey,
		settingsSubmission(entityKey, 'private', [
			{ userId: OWNER_ID, level: 'owner' },
			{ userId: PARTIAL_ID, level: 'partial' },
		]),
		() => true,
		'character',
	);
	const ownerFields = await autocomplete(
		'set',
		createInteraction(OWNER_ID),
		'field',
		'',
		entityKey,
	);
	assert.equal(ownerFields.some(choice => choice.value === 'settings'), true);
	const partialFields = await autocomplete(
		'set',
		createInteraction(PARTIAL_ID),
		'field',
		'',
		entityKey,
	);
	assert.equal(partialFields.some(choice => choice.value === 'settings'), false);
	assert.equal(partialFields.some(choice => choice.value === 'name'), true);
});

test('Settings key rename moves active/history state and rewrites every retained snapshot key', async () => {
	const oldKey = 'Settings.Rename.Old';
	const newKey = 'Settings.Rename.New';
	await createEntity(oldKey, OWNER_ID, 'character');
	await damageEntity(
		oldKey,
		5,
		false,
		() => true,
		{ actorId: OWNER_ID, maxEntries: 3 },
	);
	const result = await updateEntitySettings(
		oldKey,
		settingsSubmission(newKey, 'private', [
			{ userId: OWNER_ID, level: 'owner' },
		]),
		() => true,
		'character',
	);
	assert.equal(result.entity.key, newKey);
	await assert.rejects(fsPromises.access(getCharacterSavePath(oldKey)), {
		code: 'ENOENT',
	});
	await assert.rejects(fsPromises.access(getCharacterHistoryPath(oldKey)), {
		code: 'ENOENT',
	});
	const history = JSON.parse(await fsPromises.readFile(
		getCharacterHistoryPath(newKey),
		'utf8',
	));
	assert.ok(history.entries.every(entry => entry.character.key === newKey));
	assert.equal((await getEntity(newKey)).resources.hp.current, 95);
});

test('Settings rename rejects active and history-reserved cross-type collisions without mutation', async () => {
	const sourceKey = 'Settings.Collision.Source';
	const occupiedKey = 'Settings.Collision.Occupied';
	const historyKey = 'Settings.Collision.History';
	await createEntity(sourceKey, OWNER_ID, 'character');
	await createEntity(occupiedKey, SECOND_OWNER_ID, 'creature');
	await assert.rejects(
		updateEntitySettings(
			sourceKey,
			settingsSubmission(occupiedKey, 'private', []),
			() => true,
			'character',
		),
		{ code: 'EEXIST' },
	);
	assert.equal((await getEntity(sourceKey)).key, sourceKey);

	await createEntity(historyKey, SECOND_OWNER_ID, 'creature');
	await damageEntity(
		historyKey,
		1,
		false,
		() => true,
		{ actorId: SECOND_OWNER_ID, maxEntries: 3 },
	);
	await fsPromises.unlink(getCreatureSavePath(historyKey));
	await assert.rejects(
		updateEntitySettings(
			sourceKey,
			settingsSubmission(historyKey, 'private', []),
			() => true,
			'character',
		),
		{ code: 'EEXIST' },
	);
	assert.equal((await getEntity(sourceKey)).key, sourceKey);
});

test('rename transaction rolls back every touched path after a late failure', async () => {
	const state = {
		oldEntity: true,
		oldHistory: true,
		newEntity: false,
		newHistory: false,
	};
	await assert.rejects(
		commitEntityRename({
			cleanupNewEntity: async () => {
				state.newEntity = false;
			},
			cleanupNewHistory: async () => {
				state.newHistory = false;
			},
			deleteOldEntity: async () => {
				throw new Error('controlled active deletion failure');
			},
			deleteOldHistory: async () => {
				state.oldHistory = false;
			},
			entityKey: 'Settings.Atomic',
			restoreOldEntity: async () => {
				state.oldEntity = true;
			},
			restoreOldHistory: async () => {
				state.oldHistory = true;
			},
			writeNewEntity: async () => {
				state.newEntity = true;
			},
			writeNewHistory: async () => {
				state.newHistory = true;
			},
		}),
		{ code: 'ENTITY_SETTINGS_PERSISTENCE_FAILED' },
	);
	assert.deepEqual(state, {
		oldEntity: true,
		oldHistory: true,
		newEntity: false,
		newHistory: false,
	});
});

test('/access is removed from metadata, routing, and help', () => {
	assert.equal(commandRegistry.getCommand('access'), null);
	assert.equal(commandRegistry.getRuntimeCommands().has('access'), false);
	assert.equal(commandRegistry.getHelpMetadata().some(command => (
		command.name === 'access'
	)), false);
});

function settingsSubmission(key, visibility, access) {
	return {
		'settings.key': key,
		'settings.visibility': visibility,
		'settings.access': access
			.map(entry => `${entry.userId}:${entry.level}`)
			.join('\n'),
	};
}

async function autocomplete(
	commandName,
	interaction,
	focusedName,
	focusedValue,
	entityKey = '',
) {
	let response;
	interaction.options = {
		getFocused: () => ({ name: focusedName, value: focusedValue }),
		getString: option => option === 'entity-key' ? entityKey : null,
	};
	interaction.respond = async choices => {
		response = choices;
	};
	await commandRegistry.getRuntimeCommands().get(commandName).autocomplete({
		config,
		interaction,
	});
	return response;
}

function createCommandInteraction(userId, entityKey) {
	const interaction = createInteraction(userId);
	interaction.options = {
		getString: option => option === 'entity-key' ? entityKey : null,
	};
	interaction.reply = async response => {
		interaction.response = response;
	};
	interaction.followUp = async () => undefined;
	return interaction;
}

function createInteraction(userId, roleIds = [], ownerId = 'server-owner') {
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

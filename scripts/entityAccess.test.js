const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');

const testSaveDirectory = fs.mkdtempSync(
	path.join(os.tmpdir(), 'incredible-bot-access-'),
);
process.env.INCREDIBLE_BOT_SAVE_DIRECTORY = testSaveDirectory;

const commandRegistry = require('../commands/registry');
const {
	ENTITY_ACCESS_LEVELS,
	ENTITY_ACCESS_OPERATIONS,
	resolveEntityAccessRequest,
	setEntityUserAccess,
	validateEntityAccess,
} = require('../services/entityAccess');
const {
	createEntity,
	damageEntity,
	deleteEntity,
	getEntity,
	undoEntity,
	updateEntityAccess,
} = require('../services/entityApplicationService');
const {
	canManageEntity,
	hasFullEntityAuthority,
} = require('../util/authorization');
const { createHelpResponse } = require('../util/helpResponses');

const config = {
	botUserId: 'bot',
	discordToken: 'test-token',
	characterHistory: { maxEntries: 3 },
	locale: 'en',
	roles: { dm: 'dm-role' },
};

after(() => {
	fs.rmSync(testSaveDirectory, { recursive: true, force: true });
});

test('shared access entries validate owner and partial while none remains operation-only', () => {
	assert.deepEqual(ENTITY_ACCESS_LEVELS, ['owner', 'partial']);
	assert.deepEqual(ENTITY_ACCESS_OPERATIONS, ['owner', 'partial', 'none']);
	assert.equal(validateEntityAccess([
		{ userId: 'first', level: 'owner' },
		{ userId: 'second', level: 'partial' },
	]).length, 2);
	for (const invalid of [
		[{ userId: 'first', level: 'none' }],
		[{ userId: 'first', level: 'owner' }, { userId: 'first', level: 'partial' }],
		[{ userId: '', level: 'owner' }],
		[{ userId: 'first', level: 'owner', extra: true }],
	]) {
		assert.throws(() => validateEntityAccess(invalid));
	}

	const entity = { access: [] };
	assert.deepEqual(setEntityUserAccess(entity, 'user', 'owner'), {
		changed: true,
		level: 'owner',
		previousLevel: 'none',
		userId: 'user',
	});
	assert.equal(setEntityUserAccess(entity, 'user', 'owner').changed, false);
	assert.equal(setEntityUserAccess(entity, 'user', 'partial').changed, true);
	assert.equal(setEntityUserAccess(entity, 'user', 'none').changed, true);
	assert.equal(setEntityUserAccess(entity, 'user', 'none').changed, false);
	assert.deepEqual(entity.access, []);
	assert.deepEqual(resolveEntityAccessRequest(), { kind: 'list' });
	assert.deepEqual(resolveEntityAccessRequest({
		level: 'partial',
		rawUserId: '123456789012345678',
	}), {
		kind: 'update',
		level: 'partial',
		userId: '123456789012345678',
	});
	assert.throws(() => resolveEntityAccessRequest({
		level: 'partial',
		rawUserId: 'not-a-user-id',
	}), { code: 'INVALID_DISCORD_USER_ID' });
});

test('application access changes support multiple owners, partial control, and empty ownership', async () => {
	const entityKey = 'Access.Application.Character';
	await createEntity(entityKey, 'first-owner', 'character');
	const firstOwner = createInteraction('first-owner');
	const secondOwner = createInteraction('second-owner');
	const partial = createInteraction('partial-user');

	await changeAccess(entityKey, firstOwner, 'second-owner', 'owner');
	await changeAccess(entityKey, firstOwner, 'partial-user', 'partial');
	assert.deepEqual((await getEntity(entityKey)).access, [
		{ userId: 'first-owner', level: 'owner' },
		{ userId: 'second-owner', level: 'owner' },
		{ userId: 'partial-user', level: 'partial' },
	]);

	const damage = await damageEntity(
		entityKey,
		5,
		false,
		entity => canManageEntity(partial, entity, config),
		{ actorId: 'partial-user', maxEntries: 3 },
	);
	assert.equal(damage.entity.resources.hp.current, 95);
	await assert.rejects(
		changeAccess(entityKey, partial, 'intruder', 'partial'),
		{ code: 'NOT_ENTITY_ACCESS_OWNER' },
	);
	await assert.rejects(
		deleteEntity(
			entityKey,
			entity => hasFullEntityAuthority(partial, entity, config),
		),
		{ code: 'NOT_CHARACTER_OWNER' },
	);

	await changeAccess(entityKey, firstOwner, 'first-owner', 'none');
	assert.equal(hasFullEntityAuthority(
		firstOwner,
		await getEntity(entityKey),
		config,
	), false);
	await changeAccess(entityKey, secondOwner, 'second-owner', 'none');
	assert.deepEqual((await getEntity(entityKey)).access, [
		{ userId: 'partial-user', level: 'partial' },
	]);

	const emptyKey = 'Access.Application.EmptyOwners';
	await createEntity(emptyKey, 'only-owner', 'creature');
	await changeAccess(
		emptyKey,
		createInteraction('only-owner'),
		'only-owner',
		'none',
	);
	assert.deepEqual((await getEntity(emptyKey)).access, []);
	await changeAccess(
		emptyKey,
		createInteraction('dm-user', ['dm-role']),
		'new-owner',
		'owner',
	);
	assert.deepEqual((await getEntity(emptyKey)).access, [
		{ userId: 'new-owner', level: 'owner' },
	]);
});

test('undo preserves current access instead of restoring historical permissions', async () => {
	const entityKey = 'Access.Undo.CurrentPermissions';
	await createEntity(entityKey, 'original-owner', 'character');
	await damageEntity(
		entityKey,
		10,
		false,
		() => true,
		{ actorId: 'original-owner', maxEntries: 3 },
	);
	await updateEntityAccess(entityKey, 'partial-user', 'partial', () => true);
	await updateEntityAccess(entityKey, 'original-owner', 'none', () => true);

	const result = await undoEntity(
		entityKey,
		entity => canManageEntity(createInteraction('partial-user'), entity, config),
		{ maxEntries: 3 },
	);
	assert.equal(result.entity.resources.hp.current, 100);
	assert.deepEqual(result.entity.access, [
		{ userId: 'partial-user', level: 'partial' },
	]);
	assert.deepEqual((await getEntity(entityKey)).access, result.entity.access);
});

test('/access listing is unrestricted and retains users absent from guild caches', async () => {
	const entityKey = 'Access.Command.List';
	const ownerId = '123456789012345678';
	const departedUserId = '234567890123456789';
	await createEntity(entityKey, ownerId, 'character');
	await updateEntityAccess(entityKey, departedUserId, 'partial', () => true);
	const interaction = createCommandInteraction('viewer', {
		entityKey,
	});
	interaction.guild.members.cache.set(ownerId, {
		displayName: 'Known Owner',
		user: { id: ownerId, username: 'known-owner' },
	});
	interaction.guild.members.fetch = async () => {
		throw new Error('Access listing must not fetch guild members.');
	};
	interaction.client.users.fetch = async () => {
		throw new Error('Access listing must not fetch users.');
	};

	await commandRegistry.getRuntimeCommands().get('access').execute({
		config,
		interaction,
	});
	assert.match(interaction.response.content, /Explicit access/);
	assert.match(interaction.response.content, /Known Owner/);
	assert.match(interaction.response.content, new RegExp(`<@${ownerId}>`));
	assert.match(interaction.response.content, /Owner/);
	assert.match(interaction.response.content, new RegExp(departedUserId));
	assert.match(interaction.response.content, new RegExp(`<@${departedUserId}>`));
	assert.match(interaction.response.content, /Partial/);
	assert.deepEqual(interaction.response.allowedMentions, { users: [] });
});

test('/access native-user modification is idempotent and reauthorizes', async () => {
	const entityKey = 'Access.Command.Modify';
	await createEntity(entityKey, 'owner', 'creature');
	const targetUser = { id: 'target', username: 'Target_User' };
	const granted = createCommandInteraction('owner', {
		entityKey,
		level: 'partial',
		user: targetUser,
	});
	await commandRegistry.getRuntimeCommands().get('access').execute({
		config,
		interaction: granted,
	});
	assert.match(granted.response.content, /None.*Partial/);

	const unchanged = createCommandInteraction('owner', {
		entityKey,
		level: 'partial',
		user: targetUser,
	});
	await commandRegistry.getRuntimeCommands().get('access').execute({
		config,
		interaction: unchanged,
	});
	assert.match(unchanged.response.content, /already.*Partial/i);

	const partial = createCommandInteraction('target', {
		entityKey,
		level: 'owner',
		user: { id: 'intruder', username: 'Intruder' },
	});
	await commandRegistry.getRuntimeCommands().get('access').execute({
		config,
		interaction: partial,
	});
	assert.match(partial.response.content, /entity owner.*DM.*server owner/i);
	assert.deepEqual((await getEntity(entityKey)).access, [
		{ userId: 'owner', level: 'owner' },
		{ userId: 'target', level: 'partial' },
	]);
});

test('owners and DMs can remove stale entries by raw Discord user ID', async () => {
	const ownerEntityKey = 'Access.Command.RawOwner';
	const dmEntityKey = 'Access.Command.RawDm';
	const staleOwnerTarget = '345678901234567890';
	const staleDmTarget = '456789012345678901';
	await createEntity(ownerEntityKey, 'owner', 'character');
	await updateEntityAccess(ownerEntityKey, staleOwnerTarget, 'partial', () => true);
	await createEntity(dmEntityKey, 'other-owner', 'creature');
	await updateEntityAccess(dmEntityKey, staleDmTarget, 'owner', () => true);

	const ownerRemoval = createCommandInteraction('owner', {
		entityKey: ownerEntityKey,
		level: 'none',
		rawUserId: staleOwnerTarget,
	});
	await commandRegistry.getRuntimeCommands().get('access').execute({
		config,
		interaction: ownerRemoval,
	});
	assert.match(ownerRemoval.response.content, new RegExp(staleOwnerTarget));
	assert.match(ownerRemoval.response.content, /Partial.*None/);
	assert.deepEqual((await getEntity(ownerEntityKey)).access, [
		{ userId: 'owner', level: 'owner' },
	]);

	const dmRemoval = createCommandInteraction('dm-user', {
		entityKey: dmEntityKey,
		level: 'none',
		rawUserId: staleDmTarget,
	}, ['dm-role']);
	await commandRegistry.getRuntimeCommands().get('access').execute({
		config,
		interaction: dmRemoval,
	});
	assert.match(dmRemoval.response.content, new RegExp(staleDmTarget));
	assert.deepEqual((await getEntity(dmEntityKey)).access, [
		{ userId: 'other-owner', level: 'owner' },
	]);
});

test('partial and unauthorized users cannot modify access by raw Discord user ID', async () => {
	const entityKey = 'Access.Command.RawDenied';
	const staleUserId = '567890123456789012';
	await createEntity(entityKey, 'owner', 'character');
	await updateEntityAccess(entityKey, 'partial-user', 'partial', () => true);
	await updateEntityAccess(entityKey, staleUserId, 'partial', () => true);

	for (const userId of ['partial-user', 'outsider']) {
		const interaction = createCommandInteraction(userId, {
			entityKey,
			level: 'none',
			rawUserId: staleUserId,
		});
		await commandRegistry.getRuntimeCommands().get('access').execute({
			config,
			interaction,
		});
		assert.match(interaction.response.content, /entity owner.*DM.*server owner/i);
		assert.ok(interaction.response.flags);
	}
	assert.deepEqual((await getEntity(entityKey)).access, [
		{ userId: 'owner', level: 'owner' },
		{ userId: 'partial-user', level: 'partial' },
		{ userId: staleUserId, level: 'partial' },
	]);
});

test('/access rejects incomplete, ambiguous, and invalid raw-ID changes', async () => {
	const entityKey = 'Access.Command.InvalidTargets';
	await createEntity(entityKey, 'owner', 'character');
	const cases = [
		{ level: null, user: { id: 'target', username: 'Target' } },
		{ level: null, rawUserId: '678901234567890123' },
		{ level: 'partial' },
		{
			level: 'partial',
			rawUserId: '678901234567890123',
			user: { id: 'target', username: 'Target' },
		},
	];
	for (const options of cases) {
		const interaction = createCommandInteraction('owner', {
			entityKey,
			...options,
		});
		await commandRegistry.getRuntimeCommands().get('access').execute({
			config,
			interaction,
		});
		assert.match(interaction.response.content, /exactly one target/i);
		assert.ok(interaction.response.flags);
	}

	const invalidId = createCommandInteraction('owner', {
		entityKey,
		level: 'partial',
		rawUserId: 'not-a-user-id',
	});
	await commandRegistry.getRuntimeCommands().get('access').execute({
		config,
		interaction: invalidId,
	});
	assert.match(invalidId.response.content, /17-20 digit Discord user ID/);
	assert.ok(invalidId.response.flags);
	assert.deepEqual((await getEntity(entityKey)).access, [
		{ userId: 'owner', level: 'owner' },
	]);
});

test('entity autocomplete separates controllable, full-authority, and public views', async () => {
	const prefix = 'Access.Autocomplete.';
	await createEntity(`${prefix}Owner`, 'user', 'character');
	await createEntity(`${prefix}Partial`, 'other-owner', 'creature');
	await updateEntityAccess(`${prefix}Partial`, 'user', 'partial', () => true);
	await createEntity(`${prefix}Private`, 'other-owner', 'character');

	const controllable = await autocomplete('set', 'user', prefix);
	assert.deepEqual(new Set(controllable.map(choice => choice.value)), new Set([
		`${prefix}Owner`,
		`${prefix}Partial`,
	]));
	const deletable = await autocomplete('delete', 'user', prefix);
	assert.deepEqual(deletable.map(choice => choice.value), [`${prefix}Owner`]);
	const publicAccess = await autocomplete('access', 'user', prefix);
	assert.deepEqual(new Set(publicAccess.map(choice => choice.value)), new Set([
		`${prefix}Owner`,
		`${prefix}Partial`,
		`${prefix}Private`,
	]));
});

test('/access metadata and help document all forms and both target options', () => {
	const metadata = commandRegistry.getCommand('access');
	assert.equal(metadata.permission, 'everyone');
	assert.equal(metadata.handler, './handlers/access');
	assert.deepEqual(metadata.options.map(option => option.type), [
		'string',
		'user',
		'string',
		'string',
	]);
	const rawUserId = metadata.options.find(option => option.name === 'user-id');
	assert.equal(rawUserId.minLength, 17);
	assert.equal(rawUserId.maxLength, 20);
	const rendered = JSON.stringify(createHelpResponse({
		avatarUrl: 'https://example.com/avatar.png',
		commandName: 'access',
		config,
		interaction: createInteraction('viewer'),
		locale: 'en',
		registry: commandRegistry,
	}).embeds[0].toJSON());
	assert.match(rendered, /Discord user/);
	assert.match(rendered, /user-id/);
	assert.match(rendered, /17-20 digit/);
	assert.match(rendered, /owner.*partial.*none/i);
	assert.match(rendered, /anyone may view/i);
});

function changeAccess(entityKey, interaction, userId, level) {
	return updateEntityAccess(
		entityKey,
		userId,
		level,
		entity => hasFullEntityAuthority(interaction, entity, config),
	);
}

async function autocomplete(commandName, userId, focusedValue) {
	let response;
	const interaction = createInteraction(userId);
	interaction.options = {
		getFocused: () => ({ name: 'entity-key', value: focusedValue }),
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

function createCommandInteraction(
	userId,
	{ entityKey, level = null, rawUserId = null, user = null },
	roleIds = [],
) {
	const interaction = createInteraction(userId, roleIds);
	interaction.client = { users: { cache: new Map() } };
	interaction.guild.members = { cache: new Map() };
	interaction.options = {
		getString: optionName => ({
			'entity-key': entityKey,
			level,
			'user-id': rawUserId,
		})[optionName],
		getUser: () => user,
	};
	interaction.reply = async response => {
		interaction.response = response;
	};
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

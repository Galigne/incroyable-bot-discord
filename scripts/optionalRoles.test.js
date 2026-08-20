const assert = require('node:assert/strict');
const { test } = require('node:test');

const commandRegistry = require('../commands/registry');
const {
	authorizeCommand,
	canManageEntity,
	hasDmPermission,
	hasFullEntityAuthority,
	hasModeratorPermission,
} = require('../util/authorization');
const { validateConfig } = require('../util/configuration');
const { createHelpResponse } = require('../util/helpResponses');

const BASE_CONFIG = {
	botUserId: 'bot',
	discordToken: 'test-token',
	locale: 'en',
};

test('configuration accepts every optional role combination', () => {
	for (const roles of [
		{ dm: 'dm-role', moderator: 'moderator-role' },
		{ dm: 'dm-role' },
		{ moderator: 'moderator-role' },
		{},
	]) {
		assert.equal(validateConfig({ ...BASE_CONFIG, roles }).roles, roles);
	}
	assert.equal(validateConfig({ ...BASE_CONFIG }).roles, undefined);
});

test('configuration rejects malformed present roles and unknown role properties', () => {
	for (const roleKey of ['dm', 'moderator']) {
		for (const invalidValue of [undefined, null, '', '   ', 42, []]) {
			assert.throws(
				() => validateConfig({
					...BASE_CONFIG,
					roles: { [roleKey]: invalidValue },
				}),
				error => (
					error.code === 'INVALID_CONFIGURATION'
					&& error.field === `roles.${roleKey}`
				),
			);
		}
	}
	assert.throws(
		() => validateConfig({
			...BASE_CONFIG,
			roles: { storyteller: 'role-id' },
		}),
		error => (
			error.code === 'INVALID_CONFIGURATION'
			&& error.field === 'roles.storyteller'
		),
	);
});

test('omitted roles leave privileged commands owner-only', () => {
	const config = { ...BASE_CONFIG };
	const owner = createInteraction('owner', [], 'owner');
	const regular = createInteraction('regular');
	const dmCommand = commandRegistry.getCommand('gen');
	const moderatorCommand = commandRegistry.getCommand('reload');

	assert.equal(hasDmPermission(owner, config), true);
	assert.equal(hasModeratorPermission(owner, config), true);
	assert.equal(authorizeCommand(dmCommand, owner, config).allowed, true);
	assert.equal(authorizeCommand(moderatorCommand, owner, config).allowed, true);
	for (const command of [dmCommand, moderatorCommand]) {
		const denial = authorizeCommand(command, regular, config);
		assert.equal(denial.allowed, false);
		assert.match(denial.message, /only the server owner/i);
	}
	assert.equal(hasDmPermission(regular, config), false);
	assert.equal(hasModeratorPermission(regular, config), false);
});

test('each configured role grants only its corresponding permission', () => {
	const config = {
		...BASE_CONFIG,
		roles: { dm: 'dm-role', moderator: 'moderator-role' },
	};
	const dm = createInteraction('dm', ['dm-role']);
	const moderator = createInteraction('moderator', ['moderator-role']);

	assert.equal(authorizeCommand(commandRegistry.getCommand('gen'), dm, config).allowed, true);
	assert.equal(
		authorizeCommand(commandRegistry.getCommand('reload'), dm, config).allowed,
		false,
	);
	assert.equal(
		authorizeCommand(commandRegistry.getCommand('reload'), moderator, config).allowed,
		true,
	);
	assert.equal(
		authorizeCommand(commandRegistry.getCommand('gen'), moderator, config).allowed,
		false,
	);
});

test('explicit entity access and implicit privileged authority are distinct', () => {
	const config = { ...BASE_CONFIG };
	const explicitOwner = createInteraction('explicit-owner');
	const partial = createInteraction('partial');
	const serverOwner = createInteraction('owner', [], 'owner');
	const entity = {
		access: [
			{ userId: 'explicit-owner', level: 'owner' },
			{ userId: 'partial', level: 'partial' },
		],
	};

	assert.equal(canManageEntity(explicitOwner, entity, config), true);
	assert.equal(hasFullEntityAuthority(explicitOwner, entity, config), true);
	assert.equal(canManageEntity(partial, entity, config), true);
	assert.equal(hasFullEntityAuthority(partial, entity, config), false);
	assert.equal(canManageEntity(createInteraction('regular'), entity, config), false);
	assert.equal(canManageEntity(serverOwner, entity, config), true);
	assert.equal(hasFullEntityAuthority(serverOwner, entity, config), true);
	assert.equal(
		canManageEntity(
			createInteraction('dm', ['dm-role']),
			entity,
			{ ...BASE_CONFIG, roles: { dm: 'dm-role' } },
		),
		true,
	);
	assert.equal(
		hasFullEntityAuthority(
			createInteraction('dm', ['dm-role']),
			entity,
			{ ...BASE_CONFIG, roles: { dm: 'dm-role' } },
		),
		true,
	);
});

test('help and help autocomplete handle omitted roles safely', async () => {
	const config = { ...BASE_CONFIG };
	const regular = createInteraction('regular');
	const owner = createInteraction('owner', [], 'owner');
	const overview = createHelpResponse({
		avatarUrl: 'https://example.com/avatar.png',
		config,
		interaction: regular,
		locale: 'en',
		registry: commandRegistry,
	});
	const renderedOverview = JSON.stringify(overview.embeds[0].toJSON());
	assert.doesNotMatch(renderedOverview, /\/gen/);
	assert.doesNotMatch(renderedOverview, /\/reload/);

	const detail = createHelpResponse({
		avatarUrl: 'https://example.com/avatar.png',
		commandName: 'gen',
		config,
		interaction: owner,
		locale: 'en',
		registry: commandRegistry,
	});
	assert.match(JSON.stringify(detail.embeds[0].toJSON()), /owner-only when the role is omitted/i);

	const regularChoices = await autocompleteHelp(regular, config);
	assert.equal(regularChoices.some(choice => choice.value === 'gen'), false);
	assert.equal(regularChoices.some(choice => choice.value === 'reload'), false);
	const ownerChoices = await autocompleteHelp(owner, config);
	assert.equal(ownerChoices.some(choice => choice.value === 'gen'), true);
	assert.equal(ownerChoices.some(choice => choice.value === 'reload'), true);
});

async function autocompleteHelp(interaction, config) {
	let response;
	interaction.options = {
		getFocused: () => ({ name: 'command', value: '' }),
	};
	interaction.respond = async choices => {
		response = choices;
	};
	await commandRegistry.getRuntimeCommands().get('help').autocomplete({
		config,
		interaction,
	});
	return response;
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

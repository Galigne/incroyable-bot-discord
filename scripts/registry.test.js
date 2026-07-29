const assert = require('node:assert/strict');
const { test } = require('node:test');

const config = require('../config.json');
const commandRegistry = require('../commands/registry');
const { COMMAND_METADATA } = require('../commands/metadata');
const {
	VALID_COMMAND_CATEGORIES,
	VALID_PERMISSION_LEVELS,
	validateCommandMetadata,
} = require('../util/commandMetadata');
const { authorizeCommand } = require('../util/authorization');

test('registry registers every top-level command and grouped subcommand', () => {
	const topLevel = COMMAND_METADATA.filter(metadata => !metadata.parent);
	const registered = commandRegistry.getDiscordCommandData().map(data => data.toJSON());
	assert.deepEqual(
		registered.map(command => command.name),
		topLevel
			.toSorted((left, right) => left.registrationOrder - right.registrationOrder)
			.map(metadata => metadata.name),
	);
	assert.ok(registered.every(command => command.contexts?.includes(0)));

	for (const group of topLevel.filter(metadata => metadata.group)) {
		const data = registered.find(command => command.name === group.name);
		const children = COMMAND_METADATA
			.filter(metadata => metadata.parent === group.name)
			.toSorted((left, right) => left.registrationOrder - right.registrationOrder);
		assert.deepEqual(
			data.options.map(option => option.name),
			children.map(metadata => metadata.name),
		);
	}
});

test('metadata has unique scoped names, valid categories, and valid permissions', () => {
	assert.deepEqual(validateCommandMetadata(COMMAND_METADATA), []);
	assert.equal(
		new Set(COMMAND_METADATA.map(metadata => metadata.id)).size,
		COMMAND_METADATA.length,
	);
	assert.equal(
		new Set(COMMAND_METADATA.map(metadata => (
			`${metadata.parent ?? 'top'}:${metadata.name}`
		))).size,
		COMMAND_METADATA.length,
	);
	for (const metadata of COMMAND_METADATA) {
		assert.ok(VALID_COMMAND_CATEGORIES.includes(metadata.category));
		assert.ok(VALID_PERMISSION_LEVELS.includes(metadata.permission));
	}
});

test('metadata validation reports missing localization keys', () => {
	const invalid = COMMAND_METADATA.map((metadata, index) => (
		index === 0
			? { ...metadata, descriptionKey: 'missing.command.description' }
			: metadata
	));
	assert.ok(validateCommandMetadata(invalid).some(error => (
		error.includes('missing.command.description')
		&& error.includes('locale')
	)));

	const invalidOption = COMMAND_METADATA.map(metadata => (
		metadata.id === 'say'
			? {
				...metadata,
				options: metadata.options.map(option => ({
					...option,
					descriptionKey: 'missing.option.description',
				})),
			}
			: metadata
	));
	assert.ok(validateCommandMetadata(invalidOption).some(error => (
		error.includes('missing.option.description')
	)));
});

test('registry supports lookup and grouping by category', () => {
	assert.equal(commandRegistry.getCommand('help').id, 'help');
	assert.equal(commandRegistry.getCommand('help', 'rpg').id, 'rpg:help');
	assert.equal(commandRegistry.getCommand('rpg roll').id, 'rpg:roll');
	assert.equal(commandRegistry.getCommand('missing'), null);

	const groups = commandRegistry.groupByCategory();
	assert.deepEqual([...groups.keys()].sort(), [...VALID_COMMAND_CATEGORIES].sort());
	assert.ok(groups.get('rpg').some(metadata => metadata.id === 'rpg:roll'));
	assert.ok(groups.get('moderation').some(metadata => metadata.id === 'purge'));
});

test('registry permission filtering delegates to the existing authorization service', () => {
	const regular = createInteraction('regular', []);
	const dm = createInteraction('dm', [config.roles.dm]);
	const moderator = createInteraction('moderator', [config.roles.moderator]);
	const owner = createInteraction('owner', [], 'owner');

	assert.ok(commandRegistry.filterByUserPermissions(regular, config)
		.every(metadata => metadata.permission === 'everyone'));
	assert.ok(commandRegistry.filterByUserPermissions(dm, config)
		.some(metadata => metadata.permission === 'dm'));
	assert.equal(commandRegistry.filterByUserPermissions(dm, config)
		.some(metadata => metadata.permission === 'moderator'), false);
	assert.ok(commandRegistry.filterByUserPermissions(moderator, config)
		.some(metadata => metadata.permission === 'moderator'));
	assert.equal(commandRegistry.filterByUserPermissions(moderator, config)
		.some(metadata => metadata.permission === 'dm'), false);
	assert.equal(
		commandRegistry.filterByUserPermissions(owner, config).length,
		COMMAND_METADATA.length,
	);

	assert.equal(authorizeCommand({
		name: 'owner-test',
		permission: 'owner',
		guildOnly: true,
	}, owner, config).allowed, true);
	assert.equal(authorizeCommand({
		name: 'owner-test',
		permission: 'owner',
		guildOnly: true,
	}, regular, config).allowed, false);
});

test('registry exposes autocomplete, option, and choice metadata', async () => {
	const roll = commandRegistry.getAutocompleteMetadata('roll', 'expression', 'rpg');
	assert.equal(roll.type, 'string');
	assert.equal(roll.autocomplete.provider, 'static');
	assert.ok(roll.autocomplete.values.includes('1d20'));

	const getField = commandRegistry.getAutocompleteMetadata('get', 'field', 'rpg');
	assert.equal(getField.autocomplete.provider, 'viewable-fields');

	const heal = commandRegistry.getCommand('heal', 'rpg');
	const resource = heal.options.find(option => option.name === 'resource');
	assert.deepEqual(resource.choices.map(choice => choice.value), ['hp', 'armor', 'both']);
	assert.ok(resource.choices.every(choice => choice.nameKey));

	const rpgData = commandRegistry.getDiscordCommandData()
		.find(data => data.name === 'rpg')
		.toJSON();
	const registeredResource = rpgData.options
		.find(option => option.name === 'heal').options
		.find(option => option.name === 'resource');
	assert.deepEqual(
		registeredResource.choices.map(choice => choice.value),
		['hp', 'armor', 'both'],
	);
	assert.deepEqual(
		registeredResource.choices.map(choice => choice.name),
		['HP — Hit points', 'AR — Armor rating', 'HP and AR'],
	);

	let response;
	const runtime = commandRegistry.getRuntimeCommands().get('rpg');
	await runtime.autocomplete({
		config,
		interaction: {
			guild: { ownerId: 'owner' },
			guildId: 'guild',
			member: { roles: { cache: { has: () => false } } },
			options: {
				getFocused: () => ({ name: 'expression', value: '1d2' }),
				getSubcommand: () => 'roll',
			},
			respond: async choices => {
				response = choices;
			},
			user: { id: 'regular' },
		},
	});
	assert.deepEqual(response, [
		{ name: '1d20', value: '1d20' },
	]);
});

test('handler modules no longer duplicate command definitions', () => {
	for (const metadata of COMMAND_METADATA.filter(command => command.handler)) {
		const handler = require(`../commands/${metadata.handler.slice(2)}`);
		for (const key of [
			'access',
			'configure',
			'data',
			'description',
			'descriptionKey',
			'helpOrder',
			'name',
			'usage',
		]) {
			assert.equal(handler[key], undefined, `${metadata.id}.${key}`);
		}
		assert.equal(typeof handler.execute, 'function');
	}
});

function createInteraction(userId, roleIds, ownerId = 'owner') {
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

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { loadConfig } = require('../util/configuration');

const config = loadConfig();
const commandRegistry = require('../commands/registry');
const { COMMAND_METADATA } = require('../commands/metadata');
const {
	VALID_COMMAND_CATEGORIES,
	VALID_PERMISSION_LEVELS,
	validateCommandMetadata,
} = require('../util/commandMetadata');
const { authorizeCommand } = require('../util/authorization');

const RPG_COMMAND_NAMES = [
	'access',
	'add',
	'damage',
	'delete',
	'end-turn',
	'gen',
	'gen-character',
	'gen-creature',
	'get',
	'heal',
	'roll',
	'rules',
	'set',
	'undo',
];

test('registry registers every RPG command at the top level without an rpg group', () => {
	const registered = commandRegistry.getDiscordCommandData().map(data => data.toJSON());
	assert.deepEqual(
		registered.map(command => command.name),
		COMMAND_METADATA
			.toSorted((left, right) => left.registrationOrder - right.registrationOrder)
			.map(metadata => metadata.name),
	);
	assert.ok(registered.every(command => command.contexts?.includes(0)));
	assert.equal(registered.some(command => command.name === 'rpg'), false);
	assert.deepEqual(
		COMMAND_METADATA
			.filter(command => command.category === 'rpg')
			.map(command => command.name)
			.toSorted(),
		RPG_COMMAND_NAMES.toSorted(),
	);

	for (const metadata of COMMAND_METADATA.filter(command => command.category === 'rpg')) {
		assert.equal(metadata.parent, undefined);
		assert.equal(metadata.group, undefined);
		assert.ok(registered.some(command => command.name === metadata.name));
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
	assert.equal(commandRegistry.getCommand('help', 'rpg'), null);
	assert.equal(commandRegistry.getCommand('roll').id, 'roll');
	assert.equal(commandRegistry.getCommand('roll', 'rpg').id, 'roll');
	assert.equal(commandRegistry.getCommand('rpg'), null);
	assert.equal(commandRegistry.getCommand('rpg roll'), null);
	assert.equal(commandRegistry.getCommand('missing'), null);

	const groups = commandRegistry.groupByCategory();
	assert.deepEqual([...groups.keys()].sort(), [...VALID_COMMAND_CATEGORIES].sort());
	assert.ok(groups.get('rpg').some(metadata => metadata.id === 'roll'));
	assert.equal(groups.get('rpg').some(metadata => (
		metadata.name === 'help' || metadata.name.endsWith('-help')
	)), false);
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

	const rpgPermissions = Object.fromEntries(
		COMMAND_METADATA
			.filter(metadata => metadata.category === 'rpg')
			.map(metadata => [metadata.name, metadata.permission]),
	);
	assert.deepEqual(rpgPermissions, {
		access: 'everyone',
		add: 'everyone',
		damage: 'everyone',
		delete: 'everyone',
		'end-turn': 'everyone',
		gen: 'dm',
		'gen-character': 'dm',
		'gen-creature': 'dm',
		get: 'everyone',
		heal: 'everyone',
		roll: 'everyone',
		rules: 'everyone',
		set: 'everyone',
		undo: 'everyone',
	});
});

test('registry exposes autocomplete, option, and choice metadata', async () => {
	const accessUser = commandRegistry.getAutocompleteMetadata('access', 'user', 'rpg');
	assert.equal(accessUser.type, 'user');
	const accessUserId = commandRegistry.getAutocompleteMetadata(
		'access',
		'user-id',
		'rpg',
	);
	assert.equal(accessUserId.type, 'string');
	assert.equal(accessUserId.minLength, 17);
	assert.equal(accessUserId.maxLength, 20);
	assert.deepEqual(
		commandRegistry.getCommand('access').options
			.find(option => option.name === 'level')
			.choices.map(choice => choice.value),
		['owner', 'partial', 'none'],
	);

	const roll = commandRegistry.getAutocompleteMetadata('roll', 'expression', 'rpg');
	assert.equal(roll.type, 'string');
	assert.equal(roll.autocomplete.provider, 'static');
	assert.ok(roll.autocomplete.values.includes('1d2'));
	assert.ok(roll.autocomplete.values.includes('1d20'));

	const getField = commandRegistry.getAutocompleteMetadata('get', 'field', 'rpg');
	assert.equal(getField.autocomplete.provider, 'entity-sections');
	const setField = commandRegistry.getAutocompleteMetadata('set', 'field', 'rpg');
	assert.equal(setField.autocomplete.provider, 'entity-sections');

	const heal = commandRegistry.getCommand('heal', 'rpg');
	const resource = heal.options.find(option => option.name === 'resource');
	assert.deepEqual(resource.choices.map(choice => choice.value), ['hp', 'armor', 'both']);
	assert.ok(resource.choices.every(choice => choice.nameKey));

	const healData = commandRegistry.getDiscordCommandData()
		.find(data => data.name === 'heal')
		.toJSON();
	const registeredResource = healData.options
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
	const runtime = commandRegistry.getRuntimeCommands().get('roll');
	await runtime.autocomplete({
		config,
		interaction: {
			guild: { ownerId: 'owner' },
			guildId: 'guild',
			member: { roles: { cache: { has: () => false } } },
			options: {
				getFocused: () => ({ name: 'expression', value: '1d2' }),
			},
			respond: async choices => {
				response = choices;
			},
			user: { id: 'regular' },
		},
	});
	assert.deepEqual(response, [
		{ name: '1d2', value: '1d2' },
		{ name: '1d20', value: '1d20' },
	]);
});

test('character generation keeps its stable ID while using the renamed Discord command', () => {
	const metadata = commandRegistry.getCommand('gen-char');
	assert.equal(metadata.name, 'gen-character');
	assert.equal(commandRegistry.getCommand('gen-character'), metadata);
	assert.equal(commandRegistry.getRuntimeCommands().has('gen-character'), true);
	assert.equal(commandRegistry.getRuntimeCommands().has('gen-char'), false);
});

test('/gen exposes an optional count from 1 through 10', () => {
	const gen = commandRegistry.getCommand('gen');
	const count = gen.options.find(option => option.name === 'count');
	assert.deepEqual(
		{
			name: count.name,
			type: count.type,
			minValue: count.minValue,
			maxValue: count.maxValue,
			required: count.required,
		},
		{
			name: 'count',
			type: 'integer',
			minValue: 1,
			maxValue: 10,
			required: undefined,
		},
	);
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

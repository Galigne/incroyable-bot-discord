const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');
const { MessageFlags } = require('discord.js');

const { createInteractionHandler } = require('../runtime/interactionHandler');
const {
	createVoiceStateHandler,
	getVoiceStateUserId,
} = require('../runtime/voiceStateHandler');
const {
	getEditableEntityFieldDefinition,
	getEntityFieldDefinition,
	getEntitySections,
	getViewableEntityFieldDefinition,
} = require('../services/entityFieldCatalog');
const {
	getEditableEntityFieldValue,
} = require('../services/entityEditor');
const {
	commitMutationThenHistory,
} = require('../services/entityPersistenceTransaction');
const { combatantEditError } = require('../services/mechanics/combatantValidation');
const { validateStatProfileDocument } = require('../services/statProfileCatalog');
const {
	getConfigurationErrorMessage,
	loadConfig,
} = require('../util/configuration');
const { createEntityGetResponse } = require('../util/entityCommandResponses');
const { translateEntityOutcome } = require('../util/entityCommandErrors');
const { getEntityFieldLabel } = require('../util/entityDisplay');

const temporaryDirectory = fs.mkdtempSync(
	path.join(os.tmpdir(), 'incredible-bot-runtime-'),
);

after(() => {
	fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

test('configuration loading reports missing, malformed, and invalid files clearly', () => {
	const missingPath = path.join(temporaryDirectory, 'missing.json');
	const malformedPath = path.join(temporaryDirectory, 'malformed.json');
	const invalidPath = path.join(temporaryDirectory, 'invalid.json');
	fs.writeFileSync(malformedPath, '{ invalid', 'utf8');
	fs.writeFileSync(invalidPath, JSON.stringify({ locale: 'en' }), 'utf8');

	for (const configPath of [missingPath, malformedPath, invalidPath]) {
		assert.throws(
			() => loadConfig(configPath),
			error => {
				assert.match(getConfigurationErrorMessage(error), /configuration/i);
				return true;
			},
		);
	}
});

test('unknown runtime commands always receive the appropriate interaction response', async () => {
	const handler = createTestInteractionHandler();
	const autocomplete = createInteraction({ autocomplete: true, commandName: 'stale' });
	await handler(autocomplete);
	assert.deepEqual(autocomplete.responses, [[]]);

	const command = createInteraction({ chat: true, commandName: 'stale' });
	await handler(command);
	assert.equal(command.replies.length, 1);
	assert.match(command.replies[0].content, /temporarily unavailable/i);
	assert.equal(command.replies[0].flags, MessageFlags.Ephemeral);
});

test('interaction routing catches lookup, authorization, modal, and execution errors', async () => {
	const failures = [
		{
			client: { commands: { get: () => { throw new Error('lookup'); } } },
			interaction: createInteraction({ chat: true }),
		},
		{
			authorizeCommand: () => { throw new Error('authorization'); },
			client: createCommandClient(),
			interaction: createInteraction({ chat: true }),
		},
		{
			client: createCommandClient(),
			handleEntityInteraction: async () => { throw new Error('modal'); },
			interaction: createInteraction({ modal: true }),
		},
		{
			client: createCommandClient(async () => { throw new Error('execution'); }),
			interaction: createInteraction({ chat: true }),
		},
	];

	for (const failure of failures) {
		const handler = createTestInteractionHandler(failure);
		await handler(failure.interaction);
		assert.equal(failure.interaction.replies.length, 1);
		assert.match(failure.interaction.replies[0].content, /went wrong/i);
	}
});

test('unexpected errors follow up after acknowledgement without replying twice', async () => {
	const interaction = createInteraction({ chat: true, replied: true });
	const handler = createTestInteractionHandler({
		client: createCommandClient(async () => { throw new Error('execution'); }),
	});
	await handler(interaction);
	assert.equal(interaction.replies.length, 0);
	assert.equal(interaction.followUps.length, 1);
	assert.match(interaction.followUps[0].content, /went wrong/i);
});

test('voice-state routing tolerates partial states and excludes the bot by state ID', async () => {
	const playedChannels = [];
	const loggedErrors = [];
	const handler = createVoiceStateHandler({
		audioPath: 'C:\\media\\sound.mp3',
		getConfig: () => ({ botUserId: 'bot', channels: { teamVoice: 'team' } }),
		logger: { error: (...values) => loggedErrors.push(values) },
		playLocalAudio: async channel => playedChannels.push(channel),
	});

	await handler({ channelId: null, id: 'user' }, { channelId: 'team', channel: { id: 'team' } });
	await handler({ channelId: null, id: 'bot' }, { channelId: 'team', channel: { id: 'team' } });
	await handler({ channelId: null }, { channelId: 'team', channel: null });
	await handler(undefined, undefined);

	assert.deepEqual(playedChannels, [{ id: 'team' }]);
	assert.deepEqual(loggedErrors, []);
	assert.equal(getVoiceStateUserId({ member: null }, { member: { user: { id: 'fallback' } } }), 'fallback');
});

test('shared entity dispatchers reject unsupported types consistently', async () => {
	const invalidType = error => error.code === 'INVALID_ENTITY_TYPE';
	for (const operation of [
		() => getEntityFieldDefinition('other', 'name'),
		() => getEditableEntityFieldDefinition('other', 'name'),
		() => getViewableEntityFieldDefinition('other', 'name'),
		() => getEntitySections('other'),
		() => getEditableEntityFieldValue({ type: 'other' }, 'name'),
		() => getEntityFieldLabel('en', 'other', 'name'),
		() => createEntityGetResponse({ type: 'other' }),
		() => combatantEditError({ type: 'other' }, 'errors.invalid'),
		() => translateEntityOutcome({ translationKey: 'common.empty' }, 'en', 'other'),
	]) {
		assert.throws(operation, invalidType);
	}

	await assert.rejects(
		commitMutationThenHistory({
			commitMutation: async () => undefined,
			entityKey: 'Invalid.Type',
			entityType: 'other',
			rollbackMutation: async () => undefined,
			writeHistory: async () => undefined,
		}),
		invalidType,
	);
});

test('statistical-profile exact-key checks ignore property order only', () => {
	const stats = ['strength', 'constitution', 'dexterity', 'intelligence', 'speed', 'perception', 'charisma'];
	const map = value => Object.fromEntries(stats.map(stat => [stat, value]));
	const profile = {
		weights: map(1),
		maximums: map(20),
		minimums: map(4),
		id: 'reordered-profile',
	};
	const document = { profiles: [profile], schemaVersion: 1 };
	assert.equal(validateStatProfileDocument(document), document);
	assert.throws(
		() => validateStatProfileDocument({
			...document,
			profiles: [{ ...profile, extra: true }],
		}),
		error => error.code === 'INVALID_STAT_PROFILE_STRUCTURE',
	);
});

function createTestInteractionHandler(overrides = {}) {
	return createInteractionHandler({
		authorizeCommand: () => ({ allowed: true }),
		client: { commands: new Map() },
		getConfig: () => ({ locale: 'en' }),
		handleEntityInteraction: async () => false,
		logger: { error: () => undefined },
		runtimeReloader: {},
		token: 'token',
		...overrides,
	});
}

function createCommandClient(execute = async () => undefined) {
	return {
		commands: new Map([['known', { execute }]]),
	};
}

function createInteraction({
	autocomplete = false,
	chat = false,
	commandName = 'known',
	modal = false,
	replied = false,
} = {}) {
	const interaction = {
		commandName,
		customId: 'entity-modal',
		deferred: false,
		followUps: [],
		replied,
		replies: [],
		responses: [],
		followUp: async response => interaction.followUps.push(response),
		inGuild: () => true,
		isAutocomplete: () => autocomplete,
		isChatInputCommand: () => chat,
		isModalSubmit: () => modal,
		isRepliable: () => true,
		reply: async response => interaction.replies.push(response),
		respond: async response => interaction.responses.push(response),
	};
	return interaction;
}

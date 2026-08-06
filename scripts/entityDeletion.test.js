const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');

const testSaveDirectory = fs.mkdtempSync(
	path.join(os.tmpdir(), 'incredible-bot-deletion-'),
);
process.env.INCREDIBLE_BOT_SAVE_DIRECTORY = testSaveDirectory;

const commandRegistry = require('../commands/registry');
const {
	createEntityDeletionModal,
	handleEntityInteraction,
} = require('../commands/entity/interactions');
const {
	deleteEntity,
	undoEntity,
	updateEditableEntity,
} = require('../services/entityApplicationService');
const {
	commitPermanentDeletion,
} = require('../services/entityPersistenceTransaction');
const {
	createCharacter,
	getCharacter,
	updateCharacter,
} = require('../services/characterStore');
const {
	getCharacterHistoryPath,
	getCharacterSavePath,
} = require('../services/entityStoragePaths');
const {
	getInteractionSession,
} = require('../util/interactionSessions');
const english = require('../locales/en.json');
const french = require('../locales/fr.json');

let keyCounter = 0;

after(() => {
	fs.rmSync(testSaveDirectory, { recursive: true, force: true });
});

test('/delete opens a private exact-key modal without deleting anything', async () => {
	const characterKey = nextKey('Delete.Modal');
	await createCharacter(characterKey, 'creator');
	await createHistory(characterKey, 'Before modal');
	const historyBefore = await fsPromises.readFile(
		getCharacterHistoryPath(characterKey),
		'utf8',
	);

	const opened = await openDeleteModal(characterKey, 'creator');
	assert.equal(opened.reply, undefined);
	assert.ok(opened.modal.custom_id.startsWith('rpg-delete:'));
	assert.equal(opened.modal.title, english.rpg.delete.modalTitle);
	assert.equal(opened.modal.components.length, 2);
	assert.match(opened.modal.components[0].content, /Permanent deletion/);
	assert.match(opened.modal.components[0].content, /active save/);
	assert.match(opened.modal.components[0].content, /every retained backup/);
	assert.match(opened.modal.components[0].content, /\/undo.*cannot restore/);
	assert.ok(opened.modal.components[0].content.includes(characterKey));

	const confirmation = opened.modal.components[1];
	assert.equal(confirmation.label, english.rpg.delete.confirmationLabel);
	assert.equal(
		confirmation.description,
		english.rpg.delete.confirmationDescription,
	);
	assert.equal(confirmation.component.custom_id, 'entity-key-confirmation');
	assert.equal(
		confirmation.component.placeholder,
		english.rpg.delete.confirmationPlaceholder,
	);
	assert.equal(confirmation.component.required, true);
	assert.equal(Object.hasOwn(confirmation.component, 'value'), false);
	assert.equal((await getCharacter(characterKey)).name.firstName, 'Before modal');
	assert.equal(
		await fsPromises.readFile(getCharacterHistoryPath(characterKey), 'utf8'),
		historyBefore,
	);

	const frenchModal = createEntityDeletionModal(
		'french-session',
		characterKey,
		'fr',
	).toJSON();
	assert.equal(frenchModal.title, french.rpg.delete.modalTitle);
	assert.equal(
		frenchModal.components[1].label,
		french.rpg.delete.confirmationLabel,
	);
	assert.ok(frenchModal.components[0].content.includes(characterKey));
});

test('/delete validates existence and authorization before opening the modal', async () => {
	const characterKey = nextKey('Delete.Authorization');
	await createCharacter(characterKey, 'creator');

	const denied = await openDeleteModal(characterKey, 'stranger');
	assert.equal(denied.modal, undefined);
	assert.match(denied.reply.content, /creator.*DM.*server owner/i);
	assert.ok(denied.reply.flags);
	assert.equal((await getCharacter(characterKey)).key, characterKey);

	const missing = await openDeleteModal(nextKey('Delete.Missing'), 'creator');
	assert.equal(missing.modal, undefined);
	assert.match(missing.reply.content, /entity does not exist/i);

	const dm = await openDeleteModal(
		characterKey,
		'dm-user',
		createConfig(),
		['dm-role'],
	);
	assert.ok(dm.modal);
	const owner = await openDeleteModal(
		characterKey,
		'server-owner',
		createConfig(),
	);
	assert.ok(owner.modal);
});

test('an exact confirmation permanently removes the active save and all history', async () => {
	const characterKey = nextKey('Delete.Exact');
	await createCharacter(characterKey, 'creator');
	await createHistory(characterKey, 'With backup');
	const opened = await openDeleteModal(characterKey, 'creator');

	const submitted = await submitDeleteModal(
		opened.modal.custom_id,
		characterKey,
		'creator',
	);
	assert.equal(submitted.handled, true);
	assert.match(submitted.reply.content, /permanently deleted/i);
	assert.ok(submitted.reply.content.includes(characterKey));
	assert.ok(submitted.reply.flags);
	assert.equal(await pathExists(getCharacterSavePath(characterKey)), false);
	assert.equal(await pathExists(getCharacterHistoryPath(characterKey)), false);
	await assert.rejects(getCharacter(characterKey), { code: 'ENOENT' });
	await assert.rejects(
		undoEntity(characterKey, () => true, historyContext()),
		{ code: 'ENOENT' },
	);

	const deleteChoices = await autocomplete('delete', 'creator');
	const undoChoices = await autocomplete('undo', 'creator');
	assert.equal(deleteChoices.some(choice => choice.value === characterKey), false);
	assert.equal(undoChoices.some(choice => choice.value === characterKey), false);
});

test('permanent deletion succeeds when no history document exists', async () => {
	const characterKey = nextKey('Delete.NoHistory');
	await createCharacter(characterKey, 'creator');
	assert.equal(await pathExists(getCharacterHistoryPath(characterKey)), false);
	const opened = await openDeleteModal(characterKey, 'creator');
	const submitted = await submitDeleteModal(
		opened.modal.custom_id,
		characterKey,
		'creator',
	);
	assert.match(submitted.reply.content, /permanently deleted/i);
	assert.equal(await pathExists(getCharacterSavePath(characterKey)), false);
	assert.equal(await pathExists(getCharacterHistoryPath(characterKey)), false);
});

test('an incorrect exact-key confirmation is rejected and consumes the session', async () => {
	const characterKey = nextKey('Delete.WrongKey');
	await createCharacter(characterKey, 'creator');
	const opened = await openDeleteModal(characterKey, 'creator');

	const incorrect = await submitDeleteModal(
		opened.modal.custom_id,
		characterKey.toLowerCase(),
		'creator',
	);
	assert.match(incorrect.reply.content, /did not exactly match/i);
	assert.equal((await getCharacter(characterKey)).key, characterKey);

	const replay = await submitDeleteModal(
		opened.modal.custom_id,
		characterKey,
		'creator',
	);
	assert.match(replay.reply.content, /missing or expired/i);
	assert.equal((await getCharacter(characterKey)).key, characterKey);
});

test('another user cannot consume or submit the deletion session', async () => {
	const characterKey = nextKey('Delete.WrongUser');
	await createCharacter(characterKey, 'creator');
	const opened = await openDeleteModal(characterKey, 'creator');

	const stranger = await submitDeleteModal(
		opened.modal.custom_id,
		characterKey,
		'stranger',
	);
	assert.match(stranger.reply.content, /belongs to another user/i);
	assert.equal((await getCharacter(characterKey)).key, characterKey);

	const creator = await submitDeleteModal(
		opened.modal.custom_id,
		characterKey,
		'creator',
	);
	assert.match(creator.reply.content, /permanently deleted/i);
});

test('missing and expired deletion sessions return a localized failure', async () => {
	const missing = await submitDeleteModal(
		'rpg-delete:missing-session',
		'Missing.Key',
		'creator',
	);
	assert.match(missing.reply.content, /missing or expired/i);

	const characterKey = nextKey('Delete.Expired');
	await createCharacter(characterKey, 'creator');
	const opened = await openDeleteModal(characterKey, 'creator');
	const sessionId = opened.modal.custom_id.slice('rpg-delete:'.length);
	const session = getInteractionSession(sessionId, 'creator', 'delete');
	session.expiresAt = Date.now() - 1;
	const expired = await submitDeleteModal(
		opened.modal.custom_id,
		characterKey,
		'creator',
	);
	assert.match(expired.reply.content, /missing or expired/i);
	assert.equal((await getCharacter(characterKey)).key, characterKey);
});

test('submission reloads the entity, observes modifications, and reauthorizes', async () => {
	const modifiedKey = nextKey('Delete.Modified');
	await createCharacter(modifiedKey, 'creator');
	const modifiedModal = await openDeleteModal(modifiedKey, 'creator');
	await createHistory(modifiedKey, 'Modified after opening');
	const modified = await submitDeleteModal(
		modifiedModal.modal.custom_id,
		modifiedKey,
		'creator',
	);
	assert.match(modified.reply.content, /permanently deleted/i);
	assert.equal(await pathExists(getCharacterHistoryPath(modifiedKey)), false);

	const reassignedKey = nextKey('Delete.Reauthorized');
	await createCharacter(reassignedKey, 'creator');
	const reassignedModal = await openDeleteModal(reassignedKey, 'creator');
	await updateCharacter(reassignedKey, () => true, character => {
		character.creatorId = 'new-creator';
	});
	const denied = await submitDeleteModal(
		reassignedModal.modal.custom_id,
		reassignedKey,
		'creator',
	);
	assert.match(denied.reply.content, /creator.*DM.*server owner/i);
	assert.equal((await getCharacter(reassignedKey)).creatorId, 'new-creator');

	const disappearedKey = nextKey('Delete.Disappeared');
	await createCharacter(disappearedKey, 'creator');
	const disappearedModal = await openDeleteModal(disappearedKey, 'creator');
	await deleteEntity(disappearedKey, () => true);
	const disappeared = await submitDeleteModal(
		disappearedModal.modal.custom_id,
		disappearedKey,
		'creator',
	);
	assert.match(disappeared.reply.content, /entity does not exist/i);
});

test('the permanent-deletion transaction preserves state for both failure directions', async () => {
	const firstFailure = { active: 'before', history: 'before' };
	await assert.rejects(
		commitPermanentDeletion({
			entityKey: 'Delete.HistoryFailure',
			deleteEntity: async () => {
				firstFailure.active = 'deleted';
			},
			deleteHistory: async () => {
				throw new Error('history deletion failed');
			},
			restoreHistory: async () => {
				firstFailure.history = 'before';
			},
		}),
		{ code: 'CHARACTER_DELETION_PERSISTENCE_FAILED' },
	);
	assert.deepEqual(firstFailure, { active: 'before', history: 'before' });

	const secondFailure = { active: 'before', history: 'before' };
	await assert.rejects(
		commitPermanentDeletion({
			entityKey: 'Delete.ActiveFailure',
			deleteEntity: async () => {
				throw new Error('active deletion failed');
			},
			deleteHistory: async () => {
				secondFailure.history = 'deleted';
			},
			restoreHistory: async () => {
				secondFailure.history = 'before';
			},
		}),
		{ code: 'CHARACTER_DELETION_PERSISTENCE_FAILED' },
	);
	assert.deepEqual(secondFailure, { active: 'before', history: 'before' });
});

test('an unrecoverable deletion rollback is logged with a stable error code', async () => {
	const logged = [];
	await assert.rejects(
		commitPermanentDeletion({
			entityKey: 'Delete.Unrecoverable',
			deleteEntity: async () => {
				throw new Error('active deletion failed');
			},
			deleteHistory: async () => undefined,
			logger: {
				error: (...parts) => logged.push(parts),
			},
			restoreHistory: async () => {
				throw new Error('history restoration failed');
			},
		}),
		{ code: 'CHARACTER_DELETION_CONSISTENCY_FAILED' },
	);
	assert.equal(logged.length, 1);
	assert.match(logged[0][0], /Delete\.Unrecoverable/);
});

test('filesystem deletion failures return no partial success and preserve both files', async () => {
	for (const failureTarget of ['history', 'active']) {
		const characterKey = nextKey(`Delete.Rollback.${failureTarget}`);
		await createCharacter(characterKey, 'creator');
		await createHistory(characterKey, `Rollback ${failureTarget}`);
		const savePath = getCharacterSavePath(characterKey);
		const historyPath = getCharacterHistoryPath(characterKey);
		const saveBefore = await fsPromises.readFile(savePath, 'utf8');
		const historyBefore = await fsPromises.readFile(historyPath, 'utf8');
		const opened = await openDeleteModal(characterKey, 'creator');
		const originalUnlink = fsPromises.unlink;
		fsPromises.unlink = async targetPath => {
			if (path.resolve(targetPath) === path.resolve(
				failureTarget === 'history' ? historyPath : savePath,
			)) {
				const error = new Error(`controlled ${failureTarget} deletion failure`);
				error.code = 'EACCES';
				throw error;
			}
			return originalUnlink(targetPath);
		};

		let submitted;
		try {
			submitted = await submitDeleteModal(
				opened.modal.custom_id,
				characterKey,
				'creator',
			);
		}
		finally {
			fsPromises.unlink = originalUnlink;
		}

		assert.match(submitted.reply.content, /could not be deleted safely/i);
		assert.doesNotMatch(submitted.reply.content, /permanently deleted/i);
		assert.equal(await fsPromises.readFile(savePath, 'utf8'), saveBefore);
		assert.equal(await fsPromises.readFile(historyPath, 'utf8'), historyBefore);
	}
});

test('/delete metadata, routing, help, and locale catalogs describe permanent deletion', () => {
	const metadata = commandRegistry.getCommand('delete');
	assert.equal(metadata.handler, './handlers/delete');
	assert.equal(metadata.permission, 'everyone');
	assert.equal(
		commandRegistry.getAutocompleteMetadata('delete', 'entity-key')
			.autocomplete.provider,
		'manageable-entities',
	);
	assert.ok(commandRegistry.getHelpMetadata('rpg').includes(metadata));
	assert.match(english.rpg.delete.behavior, /exact, case-sensitive EntityKey/);
	assert.match(english.rpg.delete.behavior, /active character or creature save.*retained backup/);
	assert.match(english.rpg.delete.behavior, /cannot be undone/);
	assert.doesNotMatch(english.rpg.undo.behavior, /restoration after deletion/);
	assert.doesNotMatch(english.rpg.undo.behavior, /`\/delete` operations.*save/);

	const expectedDeleteKeys = [
		'behavior',
		'entityOption',
		'confirmationDescription',
		'confirmationLabel',
		'confirmationPlaceholder',
		'description',
		'expired',
		'incorrectConfirmation',
		'modalTitle',
		'operationFailed',
		'success',
		'warning',
		'wrongUser',
	].sort();
	assert.deepEqual(Object.keys(english.rpg.delete).sort(), expectedDeleteKeys);
	assert.deepEqual(Object.keys(french.rpg.delete).sort(), expectedDeleteKeys);
});

async function createHistory(characterKey, value) {
	return updateEditableEntity(
		characterKey,
		'name',
		{ firstName: value, lastName: '' },
		() => true,
		historyContext(),
	);
}

async function openDeleteModal(
	characterKey,
	userId,
	config = createConfig(),
	roleIds = [],
) {
	let modal;
	let reply;
	const interaction = {
		...createInteraction(userId, roleIds),
		options: {
			getString: () => characterKey,
		},
		reply: async value => {
			reply = value;
		},
		showModal: async value => {
			modal = value.toJSON();
		},
	};
	await commandRegistry.getRuntimeCommands().get('delete').execute({
		config,
		interaction,
	});
	return { interaction, modal, reply };
}

async function submitDeleteModal(customId, value, userId, roleIds = []) {
	let reply;
	const handled = await handleEntityInteraction({
		...createInteraction(userId, roleIds),
		customId,
		fields: {
			getTextInputValue: () => value,
		},
		isModalSubmit: () => true,
		reply: async response => {
			reply = response;
		},
	}, createConfig());
	return { handled, reply };
}

async function autocomplete(commandName, userId, roleIds = []) {
	let choices;
	const interaction = {
		...createInteraction(userId, roleIds),
		options: {
			getFocused: () => ({ name: 'entity-key', value: '' }),
		},
		respond: async value => {
			choices = value;
		},
	};
	await commandRegistry.getRuntimeCommands().get(commandName).autocomplete({
		config: createConfig(),
		interaction,
	});
	return choices;
}

function createInteraction(userId, roleIds = []) {
	return {
		guild: { ownerId: 'server-owner' },
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

function createConfig() {
	return {
		botUserId: 'bot',
		characterHistory: { maxEntries: 3 },
		locale: 'en',
		roles: {
			dm: 'dm-role',
			moderator: 'moderator-role',
		},
	};
}

function historyContext() {
	return {
		actorId: 'history-actor',
		maxEntries: 3,
	};
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

function nextKey(prefix) {
	keyCounter += 1;
	return `${prefix}.${keyCounter}`;
}

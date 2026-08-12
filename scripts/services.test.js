const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');

const testSaveDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'incredible-bot-services-'));
process.env.INCREDIBLE_BOT_SAVE_DIRECTORY = testSaveDirectory;

const Character = require('../models/Character');
const {
	createEntity,
	damageEntity,
	deleteEntity,
	endEntityTurn,
	getEntity,
	healEntity,
} = require('../services/entityApplicationService');
const {
	CharacterLoadError,
	listCharacters,
} = require('../services/characterStore');
const {
	getCharacterSavePath,
} = require('../services/entityStoragePaths');
const { setEditableFieldValue } = require('../services/characterEditor');
const {
	createInteractionSession,
	deleteInteractionSession,
} = require('../util/interactionSessions');
const { translateEntityOutcome } = require('../util/entityCommandErrors');

after(() => {
	fs.rmSync(testSaveDirectory, { recursive: true, force: true });
});

test('RULE editing requires Name: Level: Description with a positive integer level', () => {
	const character = new Character('Rules', 'tester');
	setEditableFieldValue(character, 'rules', 'Fire: 2: Controls flames: intensely');
	assert.deepEqual(character.rules, [{
		name: 'Fire',
		description: 'Controls flames: intensely',
		level: 2,
	}]);

	for (const invalidRule of [
		'Fire',
		'Fire: Description only',
		'Fire: abc: Description',
		'Fire: 0: Description',
		'Fire: 1:',
	]) {
		assert.throws(
			() => setEditableFieldValue(character, 'rules', invalidRule),
			error => error.code === 'INVALID_CHARACTER_EDIT',
			invalidRule,
		);
	}
});

test('character editing returns localization-independent outcomes and errors', () => {
	const character = new Character('Localization', 'tester');
	const outcome = setEditableFieldValue(character, 'personality', {
		'personality.description': 'Quiet and observant.',
		'personality.traits': 'Patient',
	});
	assert.deepEqual(outcome, {
		translationKey: 'editorResults.updated',
		translationVariables: { fieldId: 'personality' },
	});
	assert.match(translateEntityOutcome(outcome, 'fr', 'character'), /personnalité/i);

	assert.throws(
		() => setEditableFieldValue(character, 'rules', 'Fire: invalid: Description'),
		error => (
			error.code === 'INVALID_CHARACTER_EDIT'
			&& error.translationKey === 'errors.ruleLevelInvalid'
			&& error.message === 'errors.ruleLevelInvalid'
		),
	);
});

test('entity application workflows compose character persistence and mechanics', async () => {
	const characterKey = 'Application.Workflow';
	await createEntity(characterKey, 'creator', 'character');
	const damage = await damageEntity(characterKey, 25, false, () => true);
	assert.equal(damage.entity.resources.hp.current, 75);
	assert.equal(damage.damage.hpDamage, 25);

	const healing = await healEntity(characterKey, 'hp', 100, () => true);
	assert.equal(healing.entity.resources.hp.current, 100);
	const endedTurn = await endEntityTurn(characterKey, () => true);
	assert.equal(endedTurn.entity.resources.ap.current, 4);
	assert.equal((await getEntity(characterKey)).key, characterKey);

	await deleteEntity(characterKey, () => true);
	await assert.rejects(getEntity(characterKey), { code: 'ENOENT' });
});

test('interaction session callers cannot override protected metadata', () => {
	const session = createInteractionSession('set', 'real-user', {
		expiresAt: 0,
		id: 'caller-id',
		type: 'caller-type',
		userId: 'caller-user',
		value: 'preserved',
	});
	assert.notEqual(session.id, 'caller-id');
	assert.equal(session.type, 'set');
	assert.equal(session.userId, 'real-user');
	assert.ok(session.expiresAt > Date.now());
	assert.equal(session.value, 'preserved');
	deleteInteractionSession(session.id);
});

test('character listing reports malformed save files with their key', async () => {
	const savePath = getCharacterSavePath('Broken');
	fs.mkdirSync(path.dirname(savePath), { recursive: true });
	fs.writeFileSync(
		savePath,
		'{ invalid json',
		'utf8',
	);
	const errors = [];
	const characters = await listCharacters({
		onLoadError: error => errors.push(error),
	});

	assert.deepEqual(characters, []);
	assert.equal(errors.length, 1);
	assert.ok(errors[0] instanceof CharacterLoadError);
	assert.equal(errors[0].code, 'INVALID_CHARACTER_SAVE');
	assert.equal(errors[0].characterKey, 'Broken');
	assert.match(errors[0].message, /Broken/);
});

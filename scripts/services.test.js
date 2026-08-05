const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');

const testSaveDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'incredible-bot-services-'));
process.env.INCREDIBLE_BOT_SAVE_DIRECTORY = testSaveDirectory;

const Character = require('../models/Character');
const {
	createCharacter,
	damageCharacter,
	deleteCharacter,
	endCharacterTurn,
	getCharacter,
	healCharacter,
} = require('../services/characterApplicationService');
const {
	CharacterLoadError,
	listCharacters,
} = require('../services/characterStore');
const { setEditableFieldValue } = require('../services/characterEditor');
const {
	createInteractionSession,
	deleteInteractionSession,
} = require('../util/interactionSessions');
const { translateCharacterOutcome } = require('../util/characterCommandErrors');

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
	assert.match(translateCharacterOutcome(outcome, 'fr'), /personnalité/i);

	assert.throws(
		() => setEditableFieldValue(character, 'rules', 'Fire: invalid: Description'),
		error => (
			error.code === 'INVALID_CHARACTER_EDIT'
			&& error.translationKey === 'errors.ruleLevelInvalid'
			&& error.message === 'errors.ruleLevelInvalid'
		),
	);
});

test('character application workflows compose persistence and mechanics', async () => {
	const characterKey = 'Application.Workflow';
	await createCharacter(characterKey, 'creator');
	const damage = await damageCharacter(characterKey, 25, false, () => true);
	assert.equal(damage.character.status.hp.current, 75);
	assert.equal(damage.damage.hpDamage, 25);

	const healing = await healCharacter(characterKey, 'hp', 100, () => true);
	assert.equal(healing.character.status.hp.current, 100);
	const endedTurn = await endCharacterTurn(characterKey, () => true);
	assert.equal(endedTurn.character.status.ap.current, 4);
	assert.equal((await getCharacter(characterKey)).key, characterKey);

	await deleteCharacter(characterKey, () => true);
	await assert.rejects(getCharacter(characterKey), { code: 'ENOENT' });
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
	fs.writeFileSync(
		path.join(testSaveDirectory, 'Broken.json'),
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

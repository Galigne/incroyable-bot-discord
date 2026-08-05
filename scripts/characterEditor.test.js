const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');

const testSaveDirectory = fs.mkdtempSync(
	path.join(os.tmpdir(), 'incredible-bot-editor-'),
);
process.env.INCREDIBLE_BOT_SAVE_DIRECTORY = testSaveDirectory;

const Character = require('../models/Character');
const {
	createFieldModal,
	handleRpgInteraction,
	openCharacterEditor,
} = require('../commands/rpg/interactions');
const {
	getEditInputId,
} = require('../commands/rpg/editorFields');
const {
	getEditableFields,
	getEditableFieldDefinition,
} = require('../services/characterFieldCatalog');
const {
	getEditableFieldValue,
	setEditableFieldValue,
} = require('../services/characterEditor');
const {
	createCharacter,
	getCharacter,
	updateEditableCharacter,
} = require('../services/characterApplicationService');
const {
	getCharacterHistoryPath,
	getCharacterSavePath,
} = require('../services/characterStoragePaths');
const { readCharacterHistory } = require('../services/characterHistoryStore');
const { updateCharacter } = require('../services/characterStore');
const {
	translateCharacterOutcome,
} = require('../util/characterCommandErrors');
const english = require('../locales/en.json');
const french = require('../locales/fr.json');

const EDITABLE_FIELDS = [
	'name',
	'level',
	'race',
	'background',
	'personality',
	'statistics',
	'rules',
	'talents',
	'status-effects',
	'equipment',
	'inventory',
	'encumbrance',
	'hp',
	'ar',
	'ap',
	'md',
];

after(() => {
	fs.rmSync(testSaveDirectory, { recursive: true, force: true });
});

test('the editable catalog exposes only the final grouped field list', () => {
	const editableFields = getEditableFields();
	assert.deepEqual(
		editableFields.map(field => field.editId),
		EDITABLE_FIELDS,
	);
	assert.equal(editableFields.some(field => field.editKind === 'colon'), false);
	assert.equal(Object.hasOwn(english.rpg.editor, 'colonDescription'), false);
	assert.equal(Object.hasOwn(english.errors, 'colonValueCount'), false);
	assert.equal(Object.hasOwn(english.errors, 'colonValueRequired'), false);
	assert.equal(Object.hasOwn(french.rpg.editor, 'colonDescription'), false);
	assert.equal(Object.hasOwn(french.errors, 'colonValueCount'), false);
	assert.equal(Object.hasOwn(french.errors, 'colonValueRequired'), false);
	for (const removedField of [
		'firstName',
		'lastName',
		'race.name',
		'race.description',
		'race.lore',
		'appearance',
		'backstory',
		'goals',
		'personality.description',
		'personality.traits',
		'racialTrait.skillBonus',
		'racialTrait.physicalAbility',
		'stats.constitution',
		'stats.initiative',
		'encumbrance.current',
		'hp.current',
		'ap.max',
		'baseStatistics',
		'base-statistics',
		'derived-statistics',
		'statusEffects',
	]) {
		assert.equal(getEditableFieldDefinition(removedField), null, removedField);
	}
});

test('name and numeric groups are prefilled and trim valid submissions', () => {
	const character = new Character('Groups', 'tester');
	assert.deepEqual(
		Object.fromEntries([
			'name',
			'hp',
			'ar',
			'ap',
			'md',
			'encumbrance',
		].map(field => [field, getEditableFieldValue(character, field)])),
		{
			name: { firstName: '', lastName: '' },
			hp: {
				'resources.hp.current': '100',
				'resources.hp.max': '100',
			},
			ar: {
				'resources.ar.current': '0',
				'resources.ar.max': '0',
			},
			ap: {
				'resources.ap.current': '4',
				'resources.ap.max': '4',
			},
			md: {
				'resources.md.current': '5',
				'resources.md.max': '5',
			},
			encumbrance: {
				'encumbrance.current': '0',
				'encumbrance.max': '0',
			},
		},
	);

	setEditableFieldValue(character, 'name', {
		firstName: '  Ada  ',
		lastName: '  Lovelace  ',
	});
	setEditableFieldValue(character, 'hp', {
		'resources.hp.current': ' 50 ',
		'resources.hp.max': ' 120 ',
	});
	setEditableFieldValue(character, 'ar', {
		'resources.ar.current': ' 5 ',
		'resources.ar.max': ' 30 ',
	});
	setEditableFieldValue(character, 'ap', {
		'resources.ap.current': ' 3 ',
		'resources.ap.max': ' 6 ',
	});
	setEditableFieldValue(character, 'md', {
		'resources.md.current': ' 7.5 ',
		'resources.md.max': ' 12.5 ',
	});
	setEditableFieldValue(character, 'encumbrance', {
		'encumbrance.current': ' 2 ',
		'encumbrance.max': ' 15 ',
	});

	assert.equal(character.firstName, 'Ada');
	assert.equal(character.lastName, 'Lovelace');
	assert.deepEqual(character.resources, {
		hp: { current: 50, max: 120 },
		ar: { current: 5, max: 30 },
		ap: { current: 3, max: 6 },
		md: { current: 7.5, max: 12.5 },
	});
	assert.deepEqual(character.encumbrance, { current: 2, max: 15 });
});

test('statistics use one named line per base and derived value', () => {
	const character = new Character('Statistics', 'tester');
	assert.equal(
		getEditableFieldValue(character, 'statistics'),
		[
			'constitution: 10',
			'strength: 10',
			'dexterity: 10',
			'intelligence: 10',
			'speed: 10',
			'perception: 10',
			'charisma: 10',
			'initiative: 10',
			'reflexes: 10',
		].join('\n'),
	);

	setEditableFieldValue(character, 'statistics', [
		' reflexes : 19 ',
		'constitution: 11',
		' strength : 12 ',
		'dexterity: 13',
		'intelligence: 14',
		'speed: 15',
		'perception: 16',
		'charisma: 17',
		'initiative: 18',
	].join('\n'));
	assert.deepEqual(character.stats, {
		constitution: 11,
		strength: 12,
		dexterity: 13,
		intelligence: 14,
		speed: 15,
		perception: 16,
		charisma: 17,
		initiative: 18,
		reflexes: 19,
	});
});

test('either saved name component can be cleared', () => {
	const character = new Character('Names', 'tester');
	setEditableFieldValue(character, 'name', {
		firstName: 'First',
		lastName: 'Last',
	});

	setEditableFieldValue(character, 'name', {
		firstName: '',
		lastName: 'Retained',
	});
	assert.equal(character.firstName, '');
	assert.equal(character.lastName, 'Retained');

	setEditableFieldValue(character, 'name', {
		firstName: 'Retained',
		lastName: '',
	});
	assert.equal(character.firstName, 'Retained');
	assert.equal(character.lastName, '');

	setEditableFieldValue(character, 'name', {
		firstName: '',
		lastName: '',
	});
	assert.equal(character.firstName, '');
	assert.equal(character.lastName, '');
});

test('numeric groups reject missing and invalid values atomically', () => {
	for (const [field, value, translationKey] of [
		[
			'hp',
			{ 'resources.hp.current': '1' },
			'errors.groupInputMissing',
		],
		[
			'hp',
			{ 'resources.hp.current': 'one', 'resources.hp.max': '2' },
			'errors.mustBeNumber',
		],
		[
			'hp',
			{ 'resources.hp.current': '1', 'resources.hp.max': '' },
			'errors.mustBeNumber',
		],
		[
			'ap',
			{ 'resources.ap.current': '5', 'resources.ap.max': '4' },
			'errors.apCurrentAboveMax',
		],
		[
			'ap',
			{ 'resources.ap.current': '4', 'resources.ap.max': '11' },
			'errors.apRange',
		],
		[
			'ap',
			{ 'resources.ap.current': '1.5', 'resources.ap.max': '4' },
			'errors.apRange',
		],
	]) {
		const character = new Character(`Invalid-${field}`, 'tester');
		const before = JSON.stringify(character);
		assert.throws(
			() => setEditableFieldValue(character, field, value),
			error => (
				error.code === 'INVALID_CHARACTER_EDIT'
				&& error.translationKey === translationKey
			),
			`${field}: ${value}`,
		);
		assert.equal(JSON.stringify(character), before, `${field}: ${value}`);
	}
});

test('statistics reject malformed, unknown, duplicate, missing, and invalid lines atomically', () => {
	const validLines = [
		'constitution: 11',
		'strength: 12',
		'dexterity: 13',
		'intelligence: 14',
		'speed: 15',
		'perception: 16',
		'charisma: 17',
		'initiative: 18',
		'reflexes: 19',
	];
	for (const [replacement, translationKey] of [
		['constitution 11', 'errors.statisticsLineInvalid'],
		['luck: 11', 'errors.statisticsNameUnknown'],
		['strength: 11', 'errors.statisticsDuplicate'],
		[null, 'errors.statisticsMissing'],
		['constitution: nope', 'errors.mustBeNumber'],
	]) {
		const character = new Character('Invalid-Statistics', 'tester');
		const before = JSON.stringify(character);
		const lines = [...validLines];
		if (replacement === null) {
			lines.shift();
		}
		else if (translationKey === 'errors.statisticsDuplicate') {
			lines[0] = replacement;
		}
		else {
			lines[0] = replacement;
		}
		assert.throws(
			() => setEditableFieldValue(character, 'statistics', lines.join('\n')),
			error => (
				error.code === 'INVALID_CHARACTER_EDIT'
				&& error.translationKey === translationKey
			),
			translationKey,
		);
		assert.equal(JSON.stringify(character), before, translationKey);
	}
});

test('multi-input groups replace every stored target together', () => {
	const character = new Character('Groups', 'tester');
	setEditableFieldValue(character, 'race', {
		'race.name': 'Ashborn',
		'race.physicalDescription': 'Silver eyes',
		'race.lore': 'Forged in starlight',
		'racialTraits.skillBonus': 'Arcana',
		'racialTraits.physicalAbility': 'Night sight',
	});
	setEditableFieldValue(character, 'background', {
		appearance: 'Green cloak',
		backstory: 'Raised by cartographers',
		goals: 'Map the lost roads',
	});
	setEditableFieldValue(character, 'personality', {
		'personality.description': 'Quiet and curious',
		'personality.traits': '- Patient\n* Observant',
	});

	assert.deepEqual(character.race, {
		name: 'Ashborn',
		physicalDescription: 'Silver eyes',
		lore: 'Forged in starlight',
	});
	assert.deepEqual(character.racialTraits, {
		skillBonus: 'Arcana',
		physicalAbility: 'Night sight',
	});
	assert.equal(character.appearance, 'Green cloak');
	assert.equal(character.backstory, 'Raised by cartographers');
	assert.equal(character.goals, 'Map the lost roads');
	assert.deepEqual(character.personality, {
		description: 'Quiet and curious',
		traits: ['Patient', 'Observant'],
	});

	const before = JSON.stringify(character);
	assert.throws(
		() => setEditableFieldValue(character, 'race', {
			'race.name': 'Changed',
			'race.physicalDescription': 'Changed',
			'race.lore': 'Changed',
			'racialTraits.skillBonus': 'Changed',
		}),
		error => (
			error.code === 'INVALID_CHARACTER_EDIT'
			&& error.translationKey === 'errors.groupInputMissing'
		),
	);
	assert.equal(JSON.stringify(character), before);
});

test('RULE parsing requires all values, uses two separators, and is atomic', () => {
	const character = new Character('Rules', 'tester');
	setEditableFieldValue(
		character,
		'rules',
		'Fire: 2: Burns: brightly: at night\nBlink: 1: Teleports',
	);
	assert.deepEqual(character.rules, [
		{ name: 'Fire', level: 2, description: 'Burns: brightly: at night' },
		{ name: 'Blink', level: 1, description: 'Teleports' },
	]);
	assert.equal(
		getEditableFieldValue(character, 'rules'),
		'Fire:2:Burns: brightly: at night\nBlink:1:Teleports',
	);

	const before = JSON.stringify(character.rules);
	for (const [value, translationKey] of [
		[
			'Valid:1:Parsed first\nInvalid:nope:Must fail',
			'errors.ruleLevelInvalid',
		],
		['Valid:1:Parsed first\nInvalid:2:', 'errors.ruleDescriptionRequired'],
	]) {
		assert.throws(
			() => setEditableFieldValue(character, 'rules', value),
			error => (
				error.code === 'INVALID_CHARACTER_EDIT'
				&& error.translationKey === translationKey
			),
		);
		assert.equal(JSON.stringify(character.rules), before);
	}
});

test('multiline lists replace, normalize, serialize, and clear their collections', () => {
	for (const [field, property] of [
		['talents', 'talents'],
		['status-effects', 'statusEffects'],
		['equipment', 'equipment'],
		['inventory', 'inventory'],
	]) {
		const character = new Character(`List-${field}`, 'tester');
		const outcome = setEditableFieldValue(
			character,
			field,
			'  - First complete entry  \r\n\r\n* Second complete entry\r\n',
		);
		assert.deepEqual(
			character[property],
			['First complete entry', 'Second complete entry'],
			field,
		);
		assert.equal(
			getEditableFieldValue(character, field),
			'First complete entry\nSecond complete entry',
			field,
		);
		assert.deepEqual(outcome, {
			translationKey: 'editorResults.collectionUpdated',
			translationVariables: { fieldId: getEditableFieldDefinition(field).id },
		});

		setEditableFieldValue(character, field, '\n \r\n');
		assert.deepEqual(character[property], [], field);
		assert.equal(getEditableFieldValue(character, field), '', field);
	}
});

test('race, background, and personality modals prefill every separate input', () => {
	const character = createFilledCharacter();
	for (const [field, labels] of [
		['race', ['Name', 'Physical description', 'Lore', 'Skill bonus', 'Physical ability']],
		['background', ['Appearance', 'Backstory', 'Goals']],
		['personality', ['Description', 'Traits']],
	]) {
		const values = getEditableFieldValue(character, field);
		const modal = createFieldModal('session', field, values, 'en').toJSON();
		assert.deepEqual(modal.components.map(component => component.label), labels);
		assert.deepEqual(
			modal.components.map(component => component.component.custom_id),
			Object.keys(values).map(getEditInputId),
		);
		assert.deepEqual(
			modal.components.map(component => component.component.value),
			Object.values(values),
		);
	}

	const frenchRace = createFieldModal(
		'session',
		'race',
		getEditableFieldValue(character, 'race'),
		'fr',
	).toJSON();
	assert.deepEqual(
		frenchRace.components.map(component => component.label),
		['Nom', 'Description physique', 'Lore', 'Bonus de compétence', 'Capacité physique'],
	);
	assert.match(frenchRace.components[0].description, /préremplie/);
});

test('name and numeric group modals use separate prefilled inputs', () => {
	const character = createFilledCharacter();
	const nameValues = getEditableFieldValue(character, 'name');
	const nameModal = createFieldModal('session', 'name', nameValues, 'en').toJSON();
	assert.deepEqual(
		nameModal.components.map(component => component.label),
		['First name', 'Last name'],
	);
	assert.deepEqual(
		nameModal.components.map(component => component.component.value),
		['Ada', 'Lovelace'],
	);
	assert.deepEqual(
		nameModal.components.map(component => component.component.required),
		[false, false],
	);

	for (const field of [
		'hp',
		'ar',
		'ap',
		'md',
		'encumbrance',
	]) {
		const values = getEditableFieldValue(character, field);
		const modal = createFieldModal('session', field, values, 'en').toJSON();
		assert.deepEqual(
			modal.components.map(component => component.label),
			['Current', 'Maximum'],
			field,
		);
		assert.deepEqual(
			modal.components.map(component => component.component.custom_id),
			Object.keys(values).map(getEditInputId),
			field,
		);
		assert.deepEqual(
			modal.components.map(component => component.component.value),
			Object.values(values),
			field,
		);
		assert.ok(
			modal.components.every(component => component.component.required === true),
			field,
		);
		assert.ok(
			modal.components.every(component => (
				component.description === english.rpg.editor.numberDescription
			)),
			field,
		);
	}

	const frenchName = createFieldModal('session', 'name', nameValues, 'fr').toJSON();
	assert.deepEqual(
		frenchName.components.map(component => component.label),
		['Prénom', 'Nom'],
	);
	const frenchHp = createFieldModal(
		'session',
		'hp',
		getEditableFieldValue(character, 'hp'),
		'fr',
	).toJSON();
	assert.deepEqual(
		frenchHp.components.map(component => component.label),
		['Actuel', 'Maximum'],
	);
});

test('level and statistics each use one appropriately styled prefilled input', () => {
	const character = createFilledCharacter();
	const levelModal = createFieldModal(
		'session',
		'level',
		getEditableFieldValue(character, 'level'),
		'en',
	).toJSON();
	assert.equal(levelModal.components.length, 1);
	assert.equal(levelModal.components[0].component.value, '1');
	assert.equal(levelModal.components[0].component.style, 1);
	assert.equal(levelModal.components[0].component.required, true);

	const value = getEditableFieldValue(character, 'statistics');
	const modal = createFieldModal('session', 'statistics', value, 'en').toJSON();
	assert.equal(modal.title, 'Edit Statistics');
	assert.equal(modal.components.length, 1);
	assert.equal(modal.components[0].component.value, value);
	assert.equal(modal.components[0].component.style, 2);
	assert.equal(modal.components[0].component.required, true);
	assert.equal(
		modal.components[0].description,
		english.rpg.editor.statisticsDescription,
	);
});

test('one grouped application update creates one history entry and keeps save keys', async () => {
	const characterKey = 'Editor.History';
	await createCharacter(characterKey, 'creator');
	await updateEditableCharacter(
		characterKey,
		'hp',
		{
			'resources.hp.current': '80',
			'resources.hp.max': '120',
		},
		() => true,
		{ actorId: 'creator', maxEntries: 3 },
	);

	const history = await readCharacterHistory(characterKey);
	assert.equal(history.document.entries.length, 1);
	assert.equal(history.document.entries[0].action, 'set');
	assert.deepEqual(
		history.document.entries[0].character.resources.hp,
		{ current: 100, max: 100 },
	);
	const rawSave = JSON.parse(
		await fsPromises.readFile(getCharacterSavePath(characterKey), 'utf8'),
	);
	assert.deepEqual(rawSave.resources.hp, { current: 80, max: 120 });
	assert.equal(Object.hasOwn(rawSave, 'background'), false);
	assert.equal(Object.hasOwn(rawSave, 'base-statistics'), false);
});

test('/set application updates keep encumbrance manually editable and persisted', async () => {
	const characterKey = 'Editor.Encumbrance';
	await createCharacter(characterKey, 'creator');
	await updateEditableCharacter(
		characterKey,
		'encumbrance',
		{
			'encumbrance.current': '3',
			'encumbrance.max': '8',
		},
		() => true,
		{ actorId: 'creator', maxEntries: 3 },
	);

	assert.deepEqual((await getCharacter(characterKey)).encumbrance, { current: 3, max: 8 });
	const rawSave = JSON.parse(
		await fsPromises.readFile(getCharacterSavePath(characterKey), 'utf8'),
	);
	assert.deepEqual(rawSave.encumbrance, { current: 3, max: 8 });
	const history = await readCharacterHistory(characterKey);
	assert.deepEqual(
		history.document.entries[0].character.encumbrance,
		{ current: 0, max: 0 },
	);
});

test('failed grouped application updates create neither mutation nor history', async () => {
	const characterKey = 'Editor.InvalidHistory';
	await createCharacter(characterKey, 'creator');
	const before = JSON.stringify(await getCharacter(characterKey));
	await assert.rejects(
		updateEditableCharacter(
			characterKey,
			'ap',
			{
				'resources.ap.current': '7',
				'resources.ap.max': '6',
			},
			() => true,
			{ actorId: 'creator', maxEntries: 3 },
		),
		{ code: 'INVALID_CHARACTER_EDIT' },
	);
	assert.equal(JSON.stringify(await getCharacter(characterKey)), before);
	await assert.rejects(fsPromises.access(getCharacterHistoryPath(characterKey)));
});

test('modal routing submits all inputs once and repeats authorization', async () => {
	const config = createConfig();
	const characterKey = 'Editor.Routing';
	const creator = createInteraction('creator');
	await createCharacter(characterKey, creator.user.id);
	let modal;
	await openCharacterEditor({
		...creator,
		showModal: async value => {
			modal = value.toJSON();
		},
	}, config, characterKey, 'background');

	const submittedValues = {
		[getEditInputId('appearance')]: 'Blue coat',
		[getEditInputId('backstory')]: 'Former courier',
		[getEditInputId('goals')]: 'Cross every border',
	};
	let replyCount = 0;
	let successResponse;
	await handleRpgInteraction({
		...creator,
		customId: modal.custom_id,
		fields: {
			getTextInputValue: customId => submittedValues[customId],
		},
		isModalSubmit: () => true,
		reply: async value => {
			replyCount += 1;
			successResponse = value;
		},
	}, config);
	const edited = await getCharacter(characterKey);
	assert.equal(edited.appearance, 'Blue coat');
	assert.equal(edited.backstory, 'Former courier');
	assert.equal(edited.goals, 'Cross every border');
	assert.equal(replyCount, 1);
	assert.match(successResponse.content, /Background updated/);
	assert.ok(successResponse.flags);
	assert.equal(
		(await readCharacterHistory(characterKey)).document.entries.length,
		1,
	);

	const authorizationKey = 'Editor.Reauthorize';
	await createCharacter(authorizationKey, creator.user.id);
	let authorizationModal;
	await openCharacterEditor({
		...creator,
		showModal: async value => {
			authorizationModal = value.toJSON();
		},
	}, config, authorizationKey, 'name');
	await updateCharacter(authorizationKey, () => true, character => {
		character.creatorId = 'new-owner';
	});
	let deniedResponse;
	await handleRpgInteraction({
		...creator,
		customId: authorizationModal.custom_id,
		fields: {
			getTextInputValue: customId => (
				customId === getEditInputId('firstName') ? 'Unauthorized' : 'Edit'
			),
		},
		isModalSubmit: () => true,
		reply: async value => {
			deniedResponse = value;
		},
	}, config);
	assert.equal((await getCharacter(authorizationKey)).firstName, '');
	assert.equal(deniedResponse.content, english.errors.characterEditor);
	await assert.rejects(fsPromises.access(getCharacterHistoryPath(authorizationKey)));
});

test('grouped modal validation messages and descriptions are localized', () => {
	const character = createFilledCharacter();
	const englishModal = createFieldModal(
		'session',
		'statistics',
		getEditableFieldValue(character, 'statistics'),
		'en',
	).toJSON();
	const frenchModal = createFieldModal(
		'session',
		'statistics',
		getEditableFieldValue(character, 'statistics'),
		'fr',
	).toJSON();
	assert.equal(englishModal.title, 'Edit Statistics');
	assert.equal(frenchModal.title, 'Modifier Statistiques');
	assert.equal(
		englishModal.components[0].description,
		english.rpg.editor.statisticsDescription,
	);
	assert.equal(
		frenchModal.components[0].description,
		french.rpg.editor.statisticsDescription,
	);

	let validationError;
	try {
		setEditableFieldValue(character, 'statistics', 'luck: 10');
	}
	catch (error) {
		validationError = error;
	}
	assert.match(
		translateCharacterOutcome(validationError, 'en'),
		/Unknown statistic `luck`/,
	);
	assert.match(
		translateCharacterOutcome(validationError, 'fr'),
		/Statistique `luck` inconnue/,
	);
});

function createFilledCharacter() {
	const character = new Character('Modal', 'tester');
	character.firstName = 'Ada';
	character.lastName = 'Lovelace';
	character.race = {
		name: 'Ashborn',
		physicalDescription: 'Silver eyes',
		lore: 'Old lore',
	};
	character.racialTraits = {
		skillBonus: 'Arcana',
		physicalAbility: 'Night sight',
	};
	character.appearance = 'Green cloak';
	character.backstory = 'Raised by cartographers';
	character.goals = 'Map the lost roads';
	character.personality = {
		description: 'Quiet and curious',
		traits: ['Patient', 'Observant'],
	};
	return character;
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

function createInteraction(userId) {
	return {
		guild: { ownerId: 'server-owner' },
		guildId: 'guild',
		member: {
			roles: {
				cache: {
					has: () => false,
				},
			},
		},
		user: { id: userId },
	};
}

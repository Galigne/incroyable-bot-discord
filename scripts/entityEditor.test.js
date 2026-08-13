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
const Creature = require('../models/Creature');
const {
	createEntityFieldModal,
	handleEntityInteraction,
	openEntityEditor,
} = require('../commands/entity/interactions');
const {
	getEntityEditInputId,
} = require('../commands/entity/editorFields');
const {
	getEditableFields,
	getEditableFieldDefinition,
} = require('../services/characterFieldCatalog');
const {
	getEditableFieldValue,
	setEditableFieldValue,
} = require('../services/characterEditor');
const {
	getEditableEntityFieldValue,
} = require('../services/entityEditor');
const {
	createEntity,
	getEntity,
	undoEntity,
	updateEditableEntity,
} = require('../services/entityApplicationService');
const {
	getCharacterHistoryPath,
	getCharacterSavePath,
} = require('../services/entityStoragePaths');
const { readCharacterHistory } = require('../services/characterHistoryStore');
const { updateCharacter } = require('../services/characterStore');
const {
	translateEntityOutcome,
} = require('../util/entityCommandErrors');
const { createEntityGetResponse } = require('../util/entityCommandResponses');
const english = require('../locales/en.json');
const french = require('../locales/fr.json');

const EDITABLE_FIELDS = [
	'name',
	'level',
	'resources',
	'status',
	'statistics',
	'rules',
	'talents',
	'gear',
	'race',
	'background',
	'personality',
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
		'status-effects',
		'hp',
		'ar',
		'ap',
		'md',
		'equipment',
		'inventory',
		'encumbrance',
		'modifiers',
		'resources.hp',
		'resources.ar',
		'resources.ap',
		'resources.md',
	]) {
		assert.equal(getEditableFieldDefinition(removedField), null, removedField);
	}
});

test('name, status, and gear groups are prefilled and trim valid submissions', () => {
	const character = new Character('Groups', 'tester');
	assert.deepEqual(getEditableFieldValue(character, 'name'), {
		'name.firstName': '', 'name.lastName': '',
	});
	assert.deepEqual(getEditableFieldValue(character, 'resources'), {
		'resources.hp': '100:100',
		'resources.ar': '0:0',
		'resources.ap': '4:4',
		'resources.md': '5:5',
	});
	assert.deepEqual(getEditableFieldValue(character, 'status'), {
		'status.effects': '',
		'status.modifiers': '',
	});
	assert.deepEqual(getEditableFieldValue(character, 'gear'), {
		'gear.equipment': '',
		'gear.inventory': '',
		'gear.encumbrance': '0:0',
	});
	assert.throws(
		() => getEditableFieldValue(character, 'modifiers'),
		error => error.code === 'INVALID_CHARACTER_EDIT',
	);

	setEditableFieldValue(character, 'name', {
		firstName: '  Ada  ',
		lastName: '  Lovelace  ',
	});
	setEditableFieldValue(character, 'resources', {
		'resources.hp': ' 50 : 120 ',
		'resources.ar': ' 5:30 ',
		'resources.ap': ' 3 : 6 ',
		'resources.md': ' 7.5 : 12.5 ',
	});
	setEditableFieldValue(character, 'status', {
		'status.effects': '- Inspired:Temporary inspiration\n* Hidden:Concealed from view',
		'status.modifiers': '- Scarred:Old wounds remain visible\n* Pale:Unnaturally pale coloring',
	});
	setEditableFieldValue(character, 'gear', {
		equipment: '- Sword\n* Shield',
		inventory: 'Potion',
		encumbrance: ' 2 : 15 ',
	});

	assert.equal(character.name.firstName, 'Ada');
	assert.equal(character.name.lastName, 'Lovelace');
	assert.deepEqual(character.resources, {
		hp: { current: 50, max: 120 },
		ar: { current: 5, max: 30 },
		ap: { current: 3, max: 6 },
		md: { current: 7.5, max: 12.5 },
	});
	assert.deepEqual(character.status, {
		effects: [
			{ name: '- Inspired', description: 'Temporary inspiration' },
			{ name: '* Hidden', description: 'Concealed from view' },
		],
		modifiers: [
			{ name: '- Scarred', description: 'Old wounds remain visible' },
			{ name: '* Pale', description: 'Unnaturally pale coloring' },
		],
	});
	assert.deepEqual(character.gear.equipment, ['- Sword', '* Shield']);
	assert.deepEqual(character.gear.inventory, ['Potion']);
	assert.deepEqual(character.gear.encumbrance, { current: 2, max: 15 });
	setEditableFieldValue(character, 'resources', {
		'resources.hp': '50:120',
		'resources.ar': '5:30',
		'resources.ap': '3:6',
		'resources.md': '7.5:12.5',
	});
	setEditableFieldValue(character, 'status', {
		'status.effects': '',
		'status.modifiers': '',
	});
	setEditableFieldValue(character, 'gear', {
		equipment: '',
		inventory: '',
		encumbrance: '2:15',
	});
	assert.deepEqual(character.status.effects, []);
	assert.deepEqual(character.gear.equipment, []);
	assert.deepEqual(character.gear.inventory, []);
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
	assert.deepEqual(character.statistics, {
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
	assert.equal(character.name.firstName, '');
	assert.equal(character.name.lastName, 'Retained');

	setEditableFieldValue(character, 'name', {
		firstName: 'Retained',
		lastName: '',
	});
	assert.equal(character.name.firstName, 'Retained');
	assert.equal(character.name.lastName, '');

	setEditableFieldValue(character, 'name', {
		firstName: '',
		lastName: '',
	});
	assert.equal(character.name.firstName, '');
	assert.equal(character.name.lastName, '');
});

test('resources and gear reject incomplete or malformed pairs atomically', () => {
	const validResources = {
		'resources.hp': '50:100',
		'resources.ar': '5:20',
		'resources.ap': '3:6',
		'resources.md': '4:8',
	};
	for (const [field, value, translationKey] of [
		['resources', { ...validResources, 'resources.hp': undefined }, 'errors.groupInputMissing'],
		['resources', { ...validResources, 'resources.hp': '1' }, 'errors.pairFormat'],
		['resources', { ...validResources, 'resources.hp': '1:' }, 'errors.pairFormat'],
		['resources', { ...validResources, 'resources.hp': '1:2:3' }, 'errors.pairFormat'],
		['resources', { ...validResources, 'resources.hp': 'one:2' }, 'errors.mustBeNumber'],
		['resources', { ...validResources, 'resources.ap': '5:4' }, 'errors.apCurrentAboveMax'],
		['resources', { ...validResources, 'resources.ap': '4:11' }, 'errors.apRange'],
		['resources', { ...validResources, 'resources.ap': '1.5:4' }, 'errors.apRange'],
		['gear', { equipment: 'Changed', inventory: 'Changed', encumbrance: '2' }, 'errors.pairFormat'],
	]) {
		const character = new Character(`Invalid-${field}`, 'tester');
		const before = JSON.stringify(character);
		assert.throws(
			() => setEditableFieldValue(character, field, value),
			error => (
				error.code === 'INVALID_CHARACTER_EDIT'
				&& error.translationKey === translationKey
			),
			`${field}: ${JSON.stringify(value)}`,
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
		'background.backstory': 'Raised by cartographers',
		'background.goals': 'Map the lost roads',
	});
	setEditableFieldValue(character, 'personality', {
		'personality.description': 'Quiet and curious',
		'personality.traits': '- Patient\n* Observant',
	});

	assert.deepEqual(character.race, {
		name: 'Ashborn',
		physicalDescription: 'Silver eyes',
		lore: 'Forged in starlight',
		traits: {
			skillBonus: 'Arcana',
			physicalAbility: 'Night sight',
		},
	});
	assert.equal(character.background.archetype, '');
	assert.equal(character.background.physicalDescription, '');
	assert.equal(character.background.backstory, 'Raised by cartographers');
	assert.equal(character.background.goals, 'Map the lost roads');
	assert.deepEqual(character.personality, {
		description: 'Quiet and curious',
		traits: ['- Patient', '* Observant'],
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

test('multiline collections use one entry per line, trim, serialize, and clear', () => {
	for (const [field, property] of [['talents', 'talents']]) {
		const character = new Character(`List-${field}`, 'tester');
		const outcome = setEditableFieldValue(
			character,
			field,
			'  - First complete entry  \r\n\r\n* Second complete entry\r\n',
		);
		assert.deepEqual(
			character[property],
			['- First complete entry', '* Second complete entry'],
			field,
		);
		assert.equal(
			getEditableFieldValue(character, field),
			'- First complete entry\n* Second complete entry',
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
		['background', ['Backstory', 'Goals']],
		['personality', ['Traits', 'Description']],
	]) {
		const values = getEditableFieldValue(character, field);
		const modal = createEntityFieldModal('session', 'character', field, values, 'en').toJSON();
		assert.deepEqual(modal.components.map(component => component.label), labels);
		assert.deepEqual(
			modal.components.map(component => component.component.custom_id),
			Object.keys(values).map(getEntityEditInputId),
		);
		assert.deepEqual(
			modal.components.map(component => component.component.value),
			Object.values(values),
		);
	}

	const frenchRace = createEntityFieldModal(
		'session',
		'character',
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

test('name, resources, status, and gear modals use the required prefilled inputs', () => {
	const character = createFilledCharacter();
	const nameValues = getEditableFieldValue(character, 'name');
	const nameModal = createEntityFieldModal('session', 'character', 'name', nameValues, 'en').toJSON();
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

	const resourcesValues = getEditableFieldValue(character, 'resources');
	const resourcesModal = createEntityFieldModal(
		'session',
		'character',
		'resources',
		resourcesValues,
		'en',
	).toJSON();
	assert.deepEqual(
		resourcesModal.components.map(component => component.label),
		['HP', 'AR', 'AP', 'MD'],
	);
	assert.deepEqual(
		resourcesModal.components.map(component => component.component.value),
		['100:100', '0:0', '4:4', '5:5'],
	);
	assert.deepEqual(
		resourcesModal.components.map(component => component.component.style),
		[1, 1, 1, 1],
	);
	assert.deepEqual(
		resourcesModal.components.map(component => component.component.required),
		[true, true, true, true],
	);
	assert.deepEqual(
		resourcesModal.components.map(component => component.description),
		[
			english.rpg.editor.pairDescription,
			english.rpg.editor.pairDescription,
			english.rpg.editor.apPairDescription,
			english.rpg.editor.pairDescription,
		],
	);

	const statusValues = getEditableFieldValue(character, 'status');
	const statusModal = createEntityFieldModal(
		'session',
		'character',
		'status',
		statusValues,
		'en',
	).toJSON();
	assert.deepEqual(
		statusModal.components.map(component => component.label),
		['Status effects', 'Descriptive modifiers'],
	);
	assert.deepEqual(
		statusModal.components.map(component => component.component.value),
		[
			'Inspired:Temporary inspiration\nHidden:Concealed from view',
			'Scarred:Old wounds remain visible\nPale:Unnaturally pale coloring',
		],
	);
	assert.deepEqual(
		statusModal.components.map(component => component.component.style),
		[2, 2],
	);
	assert.deepEqual(
		statusModal.components.map(component => component.component.required),
		[false, false],
	);

	const gearValues = getEditableFieldValue(character, 'gear');
	const gearModal = createEntityFieldModal('session', 'character', 'gear', gearValues, 'en').toJSON();
	assert.deepEqual(
		gearModal.components.map(component => component.label),
		['Equipment', 'Inventory', 'Encumbrance'],
	);
	assert.deepEqual(
		gearModal.components.map(component => component.component.style),
		[2, 2, 1],
	);
	assert.deepEqual(
		gearModal.components.map(component => component.component.value),
		['Sword\nShield', 'Potion\nRope', '3:8'],
	);
	assert.deepEqual(
		gearModal.components.map(component => component.description),
		[
			english.rpg.editor.equipmentDescription,
			english.rpg.editor.inventoryDescription,
			english.rpg.editor.pairDescription,
		],
	);

	const frenchName = createEntityFieldModal('session', 'character', 'name', nameValues, 'fr').toJSON();
	assert.deepEqual(
		frenchName.components.map(component => component.label),
		['Prénom', 'Nom'],
	);
	const frenchStatus = createEntityFieldModal(
		'session',
		'character',
		'status',
		getEditableFieldValue(character, 'status'),
		'fr',
	).toJSON();
	assert.deepEqual(
		frenchStatus.components.map(component => component.label),
		['Effets d’état', 'Modificateurs descriptifs'],
	);
});

test('level and statistics each use one appropriately styled prefilled input', () => {
	const character = createFilledCharacter();
	const levelModal = createEntityFieldModal(
		'session',
		'character',
		'level',
		getEditableFieldValue(character, 'level'),
		'en',
	).toJSON();
	assert.equal(levelModal.components.length, 1);
	assert.equal(levelModal.components[0].component.value, '1');
	assert.equal(levelModal.components[0].component.style, 1);
	assert.equal(levelModal.components[0].component.required, true);

	const value = getEditableFieldValue(character, 'statistics');
	const modal = createEntityFieldModal('session', 'character', 'statistics', value, 'en').toJSON();
	assert.equal(modal.title, 'Edit Statistics');
	assert.equal(modal.components.length, 1);
	assert.equal(modal.components[0].component.value, value);
	assert.equal(modal.components[0].component.style, 2);
	assert.equal(modal.components[0].component.required, true);
	assert.equal(
		modal.components[0].description,
		english.rpg.editor.statisticsDescription,
	);

	const creature = new Creature('Modal.Creature', 'tester');
	const creatureLevelModal = createEntityFieldModal(
		'session',
		'creature',
		'level',
		getEditableEntityFieldValue(creature, 'level'),
		'en',
	).toJSON();
	assert.equal(
		creatureLevelModal.components[0].description,
		english.rpg.editor.creatureLevelDescription,
	);
	const creatureStatisticsModal = createEntityFieldModal(
		'session',
		'creature',
		'statistics',
		getEditableEntityFieldValue(creature, 'statistics'),
		'en',
	).toJSON();
	assert.equal(
		creatureStatisticsModal.components[0].description,
		english.rpg.editor.creatureStatisticsDescription,
	);
});

test('character and creature RULE modals show the complete format guidance', () => {
	for (const type of ['character', 'creature']) {
		const modal = createEntityFieldModal(
			'session',
			type,
			'rules',
			'Fire:2:Controls flames',
			'en',
		).toJSON();
		assert.equal(modal.components.length, 1);
		assert.equal(modal.components[0].component.style, 2, type);
		assert.equal(
			modal.components[0].description,
			english.rpg.editor.rulesDescription,
			type,
		);

		const emptyModal = createEntityFieldModal(
			'session',
			type,
			'rules',
			'',
			'en',
		).toJSON();
		assert.equal(
			emptyModal.components[0].component.placeholder,
			english.rpg.editor.rulesPlaceholder,
			type,
		);
	}
	const frenchModal = createEntityFieldModal(
		'session',
		'character',
		'rules',
		'',
		'fr',
	).toJSON();
	assert.equal(
		frenchModal.components[0].description,
		french.rpg.editor.rulesDescription,
	);
	assert.equal(
		frenchModal.components[0].component.placeholder,
		french.rpg.editor.rulesPlaceholder,
	);
});

test('collection modal instructions match each parser format and clearing behavior', () => {
	const talentModal = createEntityFieldModal(
		'session',
		'character',
		'talents',
		'',
		'en',
	).toJSON();
	assert.equal(talentModal.components[0].description, english.rpg.editor.collectionDescription);
	assert.equal(
		talentModal.components[0].component.placeholder,
		english.rpg.editor.collectionPlaceholder,
	);

	const frenchTalentModal = createEntityFieldModal(
		'session',
		'character',
		'talents',
		'',
		'fr',
	).toJSON();
	assert.equal(
		frenchTalentModal.components[0].description,
		french.rpg.editor.collectionDescription,
	);

	const personalityModal = createEntityFieldModal(
		'session',
		'character',
		'personality',
		{
			'personality.traits': '',
			'personality.description': '',
		},
		'en',
	).toJSON();
	assert.equal(
		personalityModal.components[0].description,
		english.rpg.editor.collectionDescription,
	);
	assert.equal(
		personalityModal.components[0].component.placeholder,
		english.rpg.editor.collectionPlaceholder,
	);

	const gearModal = createEntityFieldModal(
		'session',
		'character',
		'gear',
		{
			'gear.equipment': '',
			'gear.inventory': '',
			'gear.encumbrance': '0:0',
		},
		'en',
	).toJSON();
	assert.equal(gearModal.components[0].description, english.rpg.editor.equipmentDescription);
	assert.equal(gearModal.components[1].description, english.rpg.editor.inventoryDescription);
	assert.equal(
		gearModal.components[0].component.placeholder,
		english.rpg.editor.collectionPlaceholder,
	);
	assert.equal(
		gearModal.components[1].component.placeholder,
		english.rpg.editor.collectionPlaceholder,
	);

	const frenchGearModal = createEntityFieldModal(
		'session',
		'character',
		'gear',
		{
			'gear.equipment': '',
			'gear.inventory': '',
			'gear.encumbrance': '0:0',
		},
		'fr',
	).toJSON();
	assert.deepEqual(
		frenchGearModal.components.slice(0, 2).map(component => component.description),
		[
			french.rpg.editor.equipmentDescription,
			french.rpg.editor.inventoryDescription,
		],
	);

	const statusModal = createEntityFieldModal(
		'session',
		'character',
		'status',
		{
			'status.effects': '',
			'status.modifiers': '',
		},
		'en',
	).toJSON();
	assert.deepEqual(
		statusModal.components.map(component => component.description),
		[
			english.rpg.editor.describedDescription,
			english.rpg.editor.describedDescription,
		],
	);
	assert.deepEqual(
		statusModal.components.map(component => component.component.placeholder),
		[
			english.rpg.editor.describedPlaceholder,
			english.rpg.editor.describedPlaceholder,
		],
	);

	const creatureTraitsModal = createEntityFieldModal(
		'session',
		'creature',
		'traits',
		'',
		'fr',
	).toJSON();
	assert.equal(
		creatureTraitsModal.components[0].description,
		french.rpg.editor.describedDescription,
	);
	assert.equal(
		creatureTraitsModal.components[0].component.placeholder,
		french.rpg.editor.describedPlaceholder,
	);

	const resourceModal = createEntityFieldModal(
		'session',
		'creature',
		'resources',
		{
			'resources.hp': '',
			'resources.ar': '',
			'resources.ap': '',
			'resources.md': '',
		},
		'fr',
	).toJSON();
	assert.deepEqual(
		resourceModal.components.map(component => component.description),
		[
			french.rpg.editor.creaturePairDescription,
			french.rpg.editor.creaturePairDescription,
			french.rpg.editor.creatureApPairDescription,
			french.rpg.editor.creaturePairDescription,
		],
	);
	assert.deepEqual(
		resourceModal.components.map(component => component.component.placeholder),
		['50:100', '50:100', '50:100', '50:100'],
	);
});

test('one grouped status update creates one history entry and keeps save keys', async () => {
	const characterKey = 'Editor.History';
	await createEntity(characterKey, 'creator', 'character');
	await updateEditableEntity(
		characterKey,
		'status',
		{
			'status.effects': 'Inspired:Temporary inspiration\nHidden:Concealed from view',
			'status.modifiers': 'Scarred:Old wounds remain visible',
		},
		() => true,
		{ actorId: 'creator', maxEntries: 3 },
	);

	const history = await readCharacterHistory(characterKey);
	assert.equal(history.document.entries.length, 1);
	assert.equal(history.document.entries[0].action, 'set');
	assert.deepEqual(
		history.document.entries[0].character.status,
		{ effects: [], modifiers: [] },
	);
	const rawSave = JSON.parse(
		await fsPromises.readFile(getCharacterSavePath(characterKey), 'utf8'),
	);
	assert.deepEqual(rawSave.status.effects, [
		{ name: 'Inspired', description: 'Temporary inspiration' },
		{ name: 'Hidden', description: 'Concealed from view' },
	]);
	assert.deepEqual(rawSave.status.modifiers, [
		{ name: 'Scarred', description: 'Old wounds remain visible' },
	]);
	assert.deepEqual(rawSave.resources.hp, { current: 100, max: 100 });
	assert.equal(Object.hasOwn(rawSave, 'base-statistics'), false);
	await undoEntity(characterKey, () => true, { maxEntries: 3 });
	const restored = await getEntity(characterKey);
	assert.deepEqual(restored.resources, {
		hp: { current: 100, max: 100 },
		ar: { current: 0, max: 0 },
		ap: { current: 4, max: 4 },
		md: { current: 5, max: 5 },
	});
	assert.deepEqual(restored.status, { effects: [], modifiers: [] });
	assert.deepEqual(restored.status.effects, []);
});

test('/set gear updates and undo keep stored gear fields together', async () => {
	const characterKey = 'Editor.Encumbrance';
	await createEntity(characterKey, 'creator', 'character');
	await updateEditableEntity(
		characterKey,
		'gear',
		{
			equipment: 'Sword',
			inventory: 'Potion',
			encumbrance: '3:8',
		},
		() => true,
		{ actorId: 'creator', maxEntries: 3 },
	);

	const edited = await getEntity(characterKey);
	assert.deepEqual(edited.gear.equipment, ['Sword']);
	assert.deepEqual(edited.gear.inventory, ['Potion']);
	assert.deepEqual(edited.gear.encumbrance, { current: 3, max: 8 });
	const rawSave = JSON.parse(
		await fsPromises.readFile(getCharacterSavePath(characterKey), 'utf8'),
	);
	assert.deepEqual(rawSave.gear.encumbrance, { current: 3, max: 8 });
	const history = await readCharacterHistory(characterKey);
	assert.deepEqual(
		history.document.entries[0].character.gear.encumbrance,
		{ current: 0, max: 0 },
	);
	await undoEntity(characterKey, () => true, { maxEntries: 3 });
	const restored = await getEntity(characterKey);
	assert.deepEqual(restored.gear.equipment, []);
	assert.deepEqual(restored.gear.inventory, []);
	assert.deepEqual(restored.gear.encumbrance, { current: 0, max: 0 });
});

test('name, race, background, and personality updates are atomic and undoable', async () => {
	const edits = [
		['name', { firstName: 'Ada', lastName: 'Lovelace' }, character => {
			assert.equal(character.name.firstName, '');
			assert.equal(character.name.lastName, '');
		}],
		['race', {
			'race.name': 'Ashborn',
			'race.physicalDescription': 'Silver eyes',
			'race.lore': 'Old lore',
			'racialTraits.skillBonus': 'Arcana',
			'racialTraits.physicalAbility': 'Night sight',
		}, character => {
			assert.equal(character.race.name, '');
			assert.equal(character.race.traits.skillBonus, '');
		}],
		['background', {
			'background.backstory': 'Former courier',
			'background.goals': 'Map every road',
		}, character => {
			assert.equal(character.background.archetype, '');
			assert.equal(character.background.physicalDescription, '');
			assert.equal(character.background.backstory, '');
			assert.equal(character.background.goals, '');
		}],
		['personality', {
			'personality.traits': 'Patient\nObservant',
			'personality.description': 'Quiet and curious',
		}, character => {
			assert.deepEqual(character.personality.traits, []);
			assert.equal(character.personality.description, '');
		}],
	];
	for (const [index, [field, value, assertRestored]] of edits.entries()) {
		const characterKey = `Editor.Undo.${index}`;
		await createEntity(characterKey, 'creator', 'character');
		await updateEditableEntity(
			characterKey,
			field,
			value,
			() => true,
			{ actorId: 'creator', maxEntries: 3 },
		);
		assert.equal(
			(await readCharacterHistory(characterKey)).document.entries.length,
			1,
		);
		await undoEntity(characterKey, () => true, { maxEntries: 3 });
		assertRestored(await getEntity(characterKey));
	}
});

test('failed grouped application updates create neither mutation nor history', async () => {
	const characterKey = 'Editor.InvalidHistory';
	await createEntity(characterKey, 'creator', 'character');
	const before = JSON.stringify(await getEntity(characterKey));
	await assert.rejects(
		updateEditableEntity(
			characterKey,
			'status',
			{
				'status.effects': 'Changed',
				'status.modifiers': 'Stable:Persistent alteration',
			},
			() => true,
			{ actorId: 'creator', maxEntries: 3 },
		),
		{ code: 'INVALID_CHARACTER_EDIT' },
	);
	assert.equal(JSON.stringify(await getEntity(characterKey)), before);
	await assert.rejects(fsPromises.access(getCharacterHistoryPath(characterKey)));
});

test('modal routing publishes canonical post-update details and repeats authorization', async () => {
	const config = createConfig();
	const characterKey = 'Editor.Routing';
	const creator = createInteraction('creator');
	await createEntity(characterKey, creator.user.id, 'character');
	let modal;
	await openEntityEditor({
		...creator,
		showModal: async value => {
			modal = value.toJSON();
		},
	}, config, characterKey, 'background');

	const submittedValues = {
		[getEntityEditInputId('background.backstory')]: 'Former courier',
		[getEntityEditInputId('background.goals')]: 'Cross every border',
	};
	let replyCount = 0;
	let successResponse;
	await handleEntityInteraction({
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
	const edited = await getEntity(characterKey);
	assert.equal(edited.background.archetype, '');
	assert.equal(edited.background.physicalDescription, '');
	assert.equal(edited.background.backstory, 'Former courier');
	assert.equal(edited.background.goals, 'Cross every border');
	assert.equal(replyCount, 1);
	assert.match(successResponse.content, /Background updated/);
	assert.equal(successResponse.flags, undefined);
	assert.deepEqual(
		successResponse.embeds.map(embed => embed.toJSON()),
		createEntityGetResponse(edited, 'background', 'en').embeds
			.map(embed => embed.toJSON()),
	);
	assert.equal(
		(await readCharacterHistory(characterKey)).document.entries.length,
		1,
	);

	let expiredResponse;
	await handleEntityInteraction({
		...creator,
		customId: modal.custom_id,
		fields: {
			getTextInputValue: customId => submittedValues[customId],
		},
		isModalSubmit: () => true,
		reply: async value => {
			expiredResponse = value;
		},
	}, config);
	assert.equal(expiredResponse.embeds, undefined);
	assert.ok(expiredResponse.flags);

	const invalidKey = 'Editor.Routing.Invalid';
	await createEntity(invalidKey, creator.user.id, 'character');
	let invalidModal;
	await openEntityEditor({
		...creator,
		showModal: async value => {
			invalidModal = value.toJSON();
		},
	}, config, invalidKey, 'statistics');
	let invalidResponse;
	await handleEntityInteraction({
		...creator,
		customId: invalidModal.custom_id,
		fields: {
			getTextInputValue: () => 'luck: 10',
		},
		isModalSubmit: () => true,
		reply: async value => {
			invalidResponse = value;
		},
	}, config);
	assert.equal(invalidResponse.embeds, undefined);
	assert.ok(invalidResponse.flags);
	assert.equal((await getEntity(invalidKey)).statistics.strength, 10);

	const creatureKey = 'Editor.Routing.Creature';
	const creature = createInteraction('creator');
	await createEntity(creatureKey, creature.user.id, 'creature');
	let creatureModal;
	await openEntityEditor({
		...creature,
		showModal: async value => {
			creatureModal = value.toJSON();
		},
	}, config, creatureKey, 'traits');
	let creatureSuccessResponse;
	await handleEntityInteraction({
		...creature,
		customId: creatureModal.custom_id,
		fields: {
			getTextInputValue: () => 'Keen scent — Tracks across stone',
		},
		isModalSubmit: () => true,
		reply: async value => {
			creatureSuccessResponse = value;
		},
	}, config);
	const editedCreature = await getEntity(creatureKey);
	assert.deepEqual(editedCreature.traits, [
		'Keen scent — Tracks across stone',
	]);
	assert.equal(creatureSuccessResponse.flags, undefined);
	assert.deepEqual(
		creatureSuccessResponse.embeds.map(embed => embed.toJSON()),
		createEntityGetResponse(editedCreature, 'traits', 'en').embeds
			.map(embed => embed.toJSON()),
	);

	const authorizationKey = 'Editor.Reauthorize';
	await createEntity(authorizationKey, creator.user.id, 'character');
	let authorizationModal;
	await openEntityEditor({
		...creator,
		showModal: async value => {
			authorizationModal = value.toJSON();
		},
	}, config, authorizationKey, 'name');
	await updateCharacter(authorizationKey, () => true, character => {
		character.creatorId = 'new-owner';
	});
	let deniedResponse;
	await handleEntityInteraction({
		...creator,
		customId: authorizationModal.custom_id,
		fields: {
			getTextInputValue: customId => (
				customId === getEntityEditInputId('firstName') ? 'Unauthorized' : 'Edit'
			),
		},
		isModalSubmit: () => true,
		reply: async value => {
			deniedResponse = value;
		},
	}, config);
	assert.equal((await getEntity(authorizationKey)).name.firstName, '');
	assert.equal(deniedResponse.content, english.errors.entityEditor);
	assert.equal(deniedResponse.embeds, undefined);
	await assert.rejects(fsPromises.access(getCharacterHistoryPath(authorizationKey)));
});

test('grouped modal validation messages and descriptions are localized', () => {
	const character = createFilledCharacter();
	const englishModal = createEntityFieldModal(
		'session',
		'character',
		'statistics',
		getEditableFieldValue(character, 'statistics'),
		'en',
	).toJSON();
	const frenchModal = createEntityFieldModal(
		'session',
		'character',
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
		translateEntityOutcome(validationError, 'en', 'character'),
		/Unknown statistic `luck`/,
	);
	assert.match(
		translateEntityOutcome(validationError, 'fr', 'character'),
		/Statistique `luck` inconnue/,
	);
});

function createFilledCharacter() {
	const character = new Character('Modal', 'tester');
	character.name.firstName = 'Ada';
	character.name.lastName = 'Lovelace';
	character.race = {
		name: 'Ashborn',
		physicalDescription: 'Silver eyes',
		lore: 'Old lore',
	};
	character.race.traits = {
		skillBonus: 'Arcana',
		physicalAbility: 'Night sight',
	};
	character.background.archetype = 'Courier';
	character.background.physicalDescription = 'Green cloak';
	character.background.backstory = 'Raised by cartographers';
	character.background.goals = 'Map the lost roads';
	character.personality = {
		description: 'Quiet and curious',
		traits: ['Patient', 'Observant'],
	};
	character.status.effects = [
		{ name: 'Inspired', description: 'Temporary inspiration' },
		{ name: 'Hidden', description: 'Concealed from view' },
	];
	character.status.modifiers = [
		{ name: 'Scarred', description: 'Old wounds remain visible' },
		{ name: 'Pale', description: 'Unnaturally pale coloring' },
	];
	character.gear.equipment = ['Sword', 'Shield'];
	character.gear.inventory = ['Potion', 'Rope'];
	character.gear.encumbrance = { current: 3, max: 8 };
	return character;
}

function createConfig() {
	return {
		botUserId: 'bot',
		discordToken: 'test-token',
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

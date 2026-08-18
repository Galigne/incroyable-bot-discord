const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
	CHARACTER_FIELD_DEFINITIONS,
	CHARACTER_SECTION_IDS,
	getCharacterFieldDefinition,
	getCharacterSections,
	getEditableFieldDefinition,
	getViewableFieldDefinition,
} = require('../services/characterFieldCatalog');
const {
	CREATURE_FIELD_DEFINITIONS,
	CREATURE_SECTION_IDS,
	getCreatureFieldDefinition,
	getCreatureSections,
	getEditableCreatureFieldDefinition,
	getViewableCreatureFieldDefinition,
} = require('../services/creatureFieldCatalog');
const {
	createFieldCatalogBuilder,
	definePairInput,
	defineStoredField,
} = require('../services/fieldCatalogBuilder');

test('field catalog builder owns registration, normalized lookup, and capabilities', () => {
	const builder = createFieldCatalogBuilder({
		catalogName: 'test',
		sectionIds: ['profile'],
	});
	builder.addSection(
		'profile',
		'test.profile',
		'multi',
		['profile.name'],
		{
			aliases: ['details'],
			viewTargetIds: ['profile.name', 'profile.note'],
		},
	);
	builder.addField(
		'profile.name',
		'test.name',
		defineStoredField(['profile', 'name'], 'text', {
			aliases: ['displayName'],
		}),
	);
	builder.addField('profile.range', 'test.range', {
		...definePairInput(['profile.range.current', 'profile.range.max']),
	});

	const catalog = builder.build();
	const profile = catalog.getFieldDefinition('profile');
	const profileName = catalog.getFieldDefinition('profile.name');
	const profileRange = catalog.getFieldDefinition('profile.range');

	assert.equal(catalog.getFieldDefinition('PROFILE-NAME'), profileName);
	assert.equal(catalog.getFieldDefinition('display-name'), profileName);
	assert.equal(catalog.getFieldDefinition(null), null);
	assert.equal(catalog.getEditableFieldDefinition('DE-TAILS'), profile);
	assert.equal(catalog.getViewableFieldDefinition('DE-TAILS'), profile);
	assert.equal(catalog.getEditableFieldDefinition('displayName'), null);
	assert.equal(catalog.getViewableFieldDefinition('displayName'), null);
	assert.deepEqual(catalog.getSections(), [profile]);
	assert.deepEqual(catalog.getEditableFields(), [profile]);
	assert.deepEqual(catalog.getViewableFields(), [profile]);
	assert.deepEqual(profile.editInputIds, ['profile.name']);
	assert.deepEqual(profile.viewTargetIds, ['profile.name', 'profile.note']);
	assert.deepEqual(profileName.path, ['profile', 'name']);
	assert.deepEqual(profileRange.inputTargetIds, [
		'profile.range.current',
		'profile.range.max',
	]);
	for (const value of [
		catalog.definitions,
		catalog.sectionIds,
		catalog.getSections(),
		profile.editInputIds,
		profile.viewTargetIds,
		profileName.path,
		profileRange.inputTargetIds,
	]) {
		assert.equal(Object.isFrozen(value), true);
	}
	assert.throws(
		() => builder.addField('late', 'test.late'),
		/already built/,
	);
});

test('field catalog builder rejects duplicate IDs and normalized aliases', () => {
	assert.throws(
		() => createFieldCatalogBuilder({
			catalogName: 'test',
			sectionIds: ['profile', 'profile'],
		}),
		/Duplicate test section ID/,
	);

	const builder = createFieldCatalogBuilder({
		catalogName: 'test',
		sectionIds: [],
	});
	builder.addField('profile.name', 'test.name');
	assert.throws(
		() => builder.addField('profile.name', 'test.duplicate'),
		/Duplicate test field: profile\.name/,
	);
	assert.throws(
		() => builder.addField('other', 'test.other', {
			aliases: ['PROFILE-NAME'],
		}),
		/Duplicate test field alias: PROFILE-NAME/,
	);
});

test('character and creature catalogs retain independent declarations', () => {
	assert.deepEqual(
		getCharacterSections().map(definition => definition.id),
		CHARACTER_SECTION_IDS,
	);
	assert.deepEqual(
		getCreatureSections().map(definition => definition.id),
		CREATURE_SECTION_IDS,
	);
	assert.equal(CHARACTER_SECTION_IDS.includes('race'), true);
	assert.equal(CHARACTER_SECTION_IDS.includes('talents'), true);
	assert.equal(CREATURE_SECTION_IDS.includes('race'), false);
	assert.equal(CREATURE_SECTION_IDS.includes('talents'), false);
	assert.equal(CREATURE_SECTION_IDS.includes('identity'), true);
	assert.equal(CREATURE_SECTION_IDS.includes('traits'), true);

	assert.deepEqual(getCharacterFieldDefinition('name.firstName').path, [
		'name',
		'firstName',
	]);
	assert.equal(
		getCharacterFieldDefinition('name.firstName').labelKey,
		'character.fields.firstName',
	);
	assert.deepEqual(getCreatureFieldDefinition('identity.name').path, ['name']);
	assert.equal(
		getCreatureFieldDefinition('identity.name').labelKey,
		'creature.fields.name',
	);
	assert.deepEqual(
		getCharacterFieldDefinition('background').viewTargetIds,
		[
			'background.archetype',
			'background.physicalDescription',
			'background.backstory',
			'background.goals',
		],
	);
	assert.deepEqual(
		getCreatureFieldDefinition('identity').viewTargetIds,
		['identity.name', 'identity.description'],
	);

	assertCatalogDeclarations(
		CHARACTER_FIELD_DEFINITIONS,
		getCharacterFieldDefinition,
	);
	assertCatalogDeclarations(
		CREATURE_FIELD_DEFINITIONS,
		getCreatureFieldDefinition,
	);
});

test('equivalent capability aliases resolve consistently for both entity types', () => {
	for (const [getEditable, getViewable] of [
		[getEditableFieldDefinition, getViewableFieldDefinition],
		[
			getEditableCreatureFieldDefinition,
			getViewableCreatureFieldDefinition,
		],
	]) {
		for (const alias of ['statistics', 'STATS', 'STAT-S']) {
			assert.equal(getEditable(alias)?.id, 'statistics', alias);
			assert.equal(getViewable(alias)?.id, 'statistics', alias);
		}
		assert.equal(getEditable('stats.constitution'), null);
		assert.equal(getViewable('stats.constitution'), null);
	}
});

function assertCatalogDeclarations(definitions, getFieldDefinition) {
	assert.equal(Object.isFrozen(definitions), true);
	assert.equal(
		new Set(definitions.map(definition => definition.id)).size,
		definitions.length,
	);
	for (const definition of definitions) {
		assert.equal(Object.isFrozen(definition), true, definition.id);
		assert.equal(getFieldDefinition(definition.id), definition, definition.id);
		for (const alias of definition.aliases ?? []) {
			assert.equal(getFieldDefinition(alias), definition, alias);
		}
		for (const property of [
			'path',
			'editInputIds',
			'viewTargetIds',
			'inputTargetIds',
		]) {
			if (definition[property]) {
				assert.equal(
					Object.isFrozen(definition[property]),
					true,
					`${definition.id}.${property}`,
				);
			}
		}
	}
}

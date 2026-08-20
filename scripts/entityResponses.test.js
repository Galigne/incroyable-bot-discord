const assert = require('node:assert/strict');
const { test } = require('node:test');

const Character = require('../models/Character');
const Creature = require('../models/Creature');
const {
	createEndEntityTurnResponse,
	createEntityDamageResponse,
	createEntityHealResponse,
} = require('../util/entityCommandResponses');
const {
	createCharacterSummaryEmbed,
	createCharacterFieldEmbed,
} = require('../util/characterRenderer');
const {
	createCreatureFieldEmbed,
	createCreatureSummaryEmbed,
} = require('../util/creatureRenderer');
const {
	formatCombatantResource,
	formatCombatantResources,
} = require('../util/combatantDisplay');

function createTestCharacter() {
	const character = new Character('Response.Test', 'creator');
	character.name.firstName = 'Response';
	character.resources = {
		hp: { current: 42, max: 100 },
		ar: { current: 8, max: 20 },
		ap: { current: 3, max: 5 },
		md: { current: 6, max: 8 },
	};
	character.status = { effects: [], modifiers: [] };
	return character;
}

function configureSharedCombatantSections(combatant) {
	combatant.resources = {
		hp: { current: 42, max: 100 },
		ar: { current: 8, max: 20 },
		ap: { current: 3, max: 5 },
		md: { current: 6, max: 8 },
	};
	combatant.statistics = {
		constitution: 10,
		strength: 11,
		dexterity: 12,
		intelligence: 13,
		speed: 14,
		perception: 15,
		charisma: 16,
		initiative: 17,
		reflexes: 18,
	};
	combatant.status = {
		effects: [{ name: 'Inspired', description: 'Temporary inspiration' }],
		modifiers: [{ name: 'Moonlit', description: 'Glows softly' }],
	};
	combatant.rules = [{ name: 'Fire', level: 2, description: 'Controls flames' }];
	combatant.gear = {
		equipment: ['Sword'],
		inventory: ['Potion'],
		encumbrance: { current: 3, max: 8 },
	};
	return combatant;
}

test('shared resource formatting remains the formatting used by the general summary', () => {
	const character = createTestCharacter();
	const resources = formatCombatantResources(
		character,
		['hp', 'ar', 'ap', 'md'],
		'en',
	);
	const summaryStatus = createCharacterSummaryEmbed(character, 'en').toJSON().fields[0].value;

	assert.equal(resources, [
		'HP: **42 / 100 (42%)**',
		'❤️❤️❤️❤️🖤🖤🖤🖤🖤🖤',
		'AR: **8 / 20 (40%)**',
		'🟦🟦🟦🟦⬛⬛⬛⬛⬛⬛',
		'AP:',
		'🌟🌟🌟⭐⭐',
		'MD: **6 / 8 (75%)**',
		'🟧🟧🟧🟧🟧🟧🟧🟧⬛⬛',
	].join('\n'));
	assert.equal(summaryStatus, resources);
});

test('character and creature render shared combatant sections with their established output', () => {
	const fixtures = [
		{
			entity: configureSharedCombatantSections(createTestCharacter()),
			summary: createCharacterSummaryEmbed,
			field: createCharacterFieldEmbed,
			ruleDetail: '**1. Fire — Level 2**\nControls flames',
			encumbrance: 'Encumbrance: **3 / 8**',
			encumbranceInline: true,
		},
		{
			entity: configureSharedCombatantSections(
				new Creature('Response.Creature', 'creator'),
			),
			summary: createCreatureSummaryEmbed,
			field: createCreatureFieldEmbed,
			ruleDetail: '**Fire (2)** - Controls flames',
			encumbrance: '**3 / 8**',
			encumbranceInline: undefined,
		},
	];
	for (const fixture of fixtures) {
		const summary = fixture.summary(fixture.entity, 'en').toJSON();
		assert.equal(summary.fields[0].value, [
			'HP: **42 / 100 (42%)**',
			'❤️❤️❤️❤️🖤🖤🖤🖤🖤🖤',
			'AR: **8 / 20 (40%)**',
			'🟦🟦🟦🟦⬛⬛⬛⬛⬛⬛',
			'AP:',
			'🌟🌟🌟⭐⭐',
			'MD: **6 / 8 (75%)**',
			'🟧🟧🟧🟧🟧🟧🟧🟧⬛⬛',
			'',
			'**Status effects**',
			'**Inspired** - Temporary inspiration',
			'',
			'**Descriptive modifiers**',
			'**Moonlit** - Glows softly',
		].join('\n'));
		assert.match(summary.fields[1].value, /Constitution: \*\*10\*\*/);
		assert.match(summary.fields[1].value, /Perception: \*\*15\*\*/);
		assert.equal(summary.fields[2].value, '1. Fire (Level 2)');

		const resources = fixture.field(fixture.entity, 'resources', 'en').toJSON();
		assert.deepEqual(resources.fields.map(field => field.name), [
			'Hit points', 'Armor rating', 'Action points', 'Movement distance',
		]);
		assert.equal(resources.fields[0].value, 'HP: **42 / 100 (42%)**\n❤️❤️❤️❤️🖤🖤🖤🖤🖤🖤');

		const status = fixture.field(fixture.entity, 'status', 'en').toJSON();
		assert.deepEqual(status.fields.map(field => field.name), [
			'Status effects', 'Descriptive modifiers',
		]);
		assert.equal(status.fields[1].value, '**Moonlit** - Glows softly');

		const statistics = fixture.field(fixture.entity, 'statistics', 'en').toJSON();
		assert.deepEqual(statistics.fields.map(field => field.name), [
			'Base statistics', 'Derived statistics',
		]);
		assert.equal(statistics.fields[0].value, [
			'Constitution: **10**',
			'Strength: **11**',
			'Dexterity: **12**',
			'Intelligence: **13**',
			'Speed: **14**',
			'Perception: **15**',
			'Charisma: **16**',
		].join('\n'));
		assert.equal(statistics.fields[1].value, [
			'Initiative: **17**',
			'Reflexes: **18**',
		].join('\n'));

		const rules = fixture.field(fixture.entity, 'rules', 'en').toJSON();
		assert.equal(rules.description, fixture.ruleDetail);

		const gear = fixture.field(fixture.entity, 'gear', 'en').toJSON();
		assert.deepEqual(gear.fields.map(field => field.name), [
			'Equipment', 'Inventory', 'Encumbrance',
		]);
		assert.equal(gear.fields[0].value, '1. Sword');
		assert.equal(gear.fields[1].value, '1. Potion');
		assert.equal(gear.fields[2].value, fixture.encumbrance);
		assert.equal(gear.fields[2].inline, fixture.encumbranceInline);
	}
});

test('damage response displays final HP before final AR without a plain final summary', () => {
	const character = createTestCharacter();
	const response = createEntityDamageResponse({
		entity: character,
		damage: { arDamage: 12, hpDamage: 8, piercing: false },
		damageAmount: 20,
	}, 'en');
	const resources = formatCombatantResources(character, ['hp', 'ar'], 'en');

	assert.ok(response.endsWith(resources));
	assert.ok(response.indexOf('HP:') < response.indexOf('AR:'));
	assert.equal(response.match(/HP: \*\*42 \/ 100/g)?.length, 1);
	assert.equal(response.match(/AR: \*\*8 \/ 20/g)?.length, 1);
	assert.doesNotMatch(response, /HP: \*\*42\/100|AR: \*\*8\/20/);
});

test('healing responses display only affected final resources in canonical order', () => {
	const character = createTestCharacter();
	for (const [changes, expectedIds] of [
		[[{ resource: 'hp' }], ['hp']],
		[[{ resource: 'ar' }], ['ar']],
		[[{ resource: 'ar' }, { resource: 'hp' }], ['hp', 'ar']],
	]) {
		const response = createEntityHealResponse({
			entity: character,
			changes,
			percentage: 50,
		}, 'en');
		assert.ok(response.endsWith(formatCombatantResources(character, expectedIds, 'en')));
		assert.doesNotMatch(response, /→/);
	}
});

test('end-turn response displays final AP before localized MD or DD', () => {
	const character = createTestCharacter();
	for (const locale of ['en', 'fr']) {
		const response = createEndEntityTurnResponse({ entity: character }, locale);
		const resources = formatCombatantResources(character, ['ap', 'md'], locale);
		assert.ok(response.endsWith(resources));
		assert.ok(response.indexOf(locale === 'fr' ? 'PA:' : 'AP:')
			< response.indexOf(locale === 'fr' ? 'DD:' : 'MD:'));
		assert.doesNotMatch(response, /with 3 AP and 6 MD|avec 3 PA et 6 DD/);
	}
});

test('shared resource formatter uses English and French resource labels', () => {
	const character = createTestCharacter();
	assert.match(formatCombatantResource(character, 'hp', 'en'), /^HP:/);
	assert.match(formatCombatantResource(character, 'ar', 'en'), /^AR:/);
	assert.match(formatCombatantResource(character, 'ap', 'en'), /^AP:/);
	assert.match(formatCombatantResource(character, 'md', 'en'), /^MD:/);
	assert.match(formatCombatantResource(character, 'hp', 'fr'), /^PV:/);
	assert.match(formatCombatantResource(character, 'ar', 'fr'), /^PR:/);
	assert.match(formatCombatantResource(character, 'ap', 'fr'), /^PA:/);
	assert.match(formatCombatantResource(character, 'md', 'fr'), /^DD:/);
});

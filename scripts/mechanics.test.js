const assert = require('node:assert/strict');
const { test } = require('node:test');
const Character = require('../models/Character');
const {
	calculateArmorRating,
	canEquipArmor,
} = require('../services/mechanics/armor');
const {
	copyRules,
	copyStringList,
	copyTalentList,
	validateActionPointEdit,
} = require('../services/mechanics/characterValidation');
const {
	allocateRuleLevels,
	calculateRulePoints,
	calculateStatBudget,
	calculateStatCost,
	calculateTalentCount,
	generateStats,
} = require('../services/mechanics/characterGeneration');
const { dealDamage } = require('../services/mechanics/damage');
const { BASE_STATS } = require('../services/mechanics/constants');
const {
	calculateMaxAp,
	calculateMaxHp,
	calculateMaxMovementDistance,
	calculateRestoredResourceValue,
	createGeneratedResources,
	createResourcesFromSave,
	resetTurnResources,
	restoreHealingResources,
	restoreResource,
} = require('../services/mechanics/resources');
const {
	createStats,
	recalculateDerivedStats,
} = require('../services/mechanics/statistics');
const { populateRandomCharacter } = require('../services/randomCharacterGenerator');
const { getStatProfile } = require('../services/statProfileCatalog');
const {
	createLocalizedCharacterGenerationOptions,
} = require('../util/characterGenerationLocalization');

test('damage preserves AR-first and piercing behavior', () => {
	const character = createCharacterFixture();
	character.resources.hp.current = 100;
	character.resources.ar.current = 30;

	assert.deepEqual(dealDamage(character, 40), {
		arDamage: 30,
		hpDamage: 10,
		piercing: false,
	});
	assert.equal(character.resources.ar.current, 0);
	assert.equal(character.resources.hp.current, 90);

	character.resources.ar.current = 20;
	assert.deepEqual(dealDamage(character, 15, true), {
		arDamage: 0,
		hpDamage: 15,
		piercing: true,
	});
	assert.equal(character.resources.ar.current, 20);
	assert.equal(character.resources.hp.current, 75);
	assert.throws(
		() => dealDamage(character, 0),
		error => error.code === 'INVALID_CHARACTER_EDIT',
	);
});

test('healing restores HP, armor, or both with shared rounding', () => {
	const character = createCharacterFixture();
	character.resources.hp = { current: 1, max: 101 };
	character.resources.ar = { current: 0, max: 33 };
	character.resources.ap = { current: 0, max: 6 };
	character.resources.md = { current: 0, max: 7.5 };

	assert.deepEqual(restoreResource(character, 'hp', 50), { current: 51, max: 101 });
	assert.deepEqual(restoreResource(character, 'ar', 25), { current: 8, max: 33 });
	assert.deepEqual(restoreHealingResources(character, 'hp', 25), [
		{ resource: 'hp', previous: 51, current: 25, max: 101 },
	]);
	assert.deepEqual(restoreHealingResources(character, 'armor', 50), [
		{ resource: 'ar', previous: 8, current: 17, max: 33 },
	]);
	character.resources.hp.current = 10;
	character.resources.ar.current = 5;
	assert.deepEqual(restoreHealingResources(character, 'both', 50), [
		{ resource: 'hp', previous: 10, current: 51, max: 101 },
		{ resource: 'ar', previous: 5, current: 17, max: 33 },
	]);
	assert.equal(calculateRestoredResourceValue(101, 100), 101);
	assert.equal(character.resources.hp.current <= character.resources.hp.max, true);
	assert.equal(character.resources.ar.current <= character.resources.ar.max, true);

	for (const invalidPercentage of [Number.NaN, Number.POSITIVE_INFINITY, -0.01, 100.01]) {
		assert.throws(
			() => restoreHealingResources(character, 'both', invalidPercentage),
			error => error.code === 'INVALID_CHARACTER_EDIT',
		);
	}
	assert.throws(
		() => restoreHealingResources(character, 'ar', 50),
		error => error.code === 'INVALID_CHARACTER_EDIT',
	);

	resetTurnResources(character);
	assert.equal(character.resources.ap.current, 6);
	assert.equal(character.resources.md.current, 7.5);
});

test('resource, armor, AP, and movement formulas preserve generated values', () => {
	assert.equal(calculateMaxHp(10, 10), 280);
	assert.equal(calculateMaxAp(1), 4);
	assert.equal(calculateMaxAp(4), 5);
	assert.equal(calculateMaxAp(7), 6);
	assert.equal(calculateMaxAp(10), 8);
	assert.equal(calculateMaxMovementDistance(15), 7.5);
	assert.equal(calculateArmorRating(280, 5), 14);
	assert.equal(canEquipArmor(12, 12), true);
	assert.equal(canEquipArmor(11, 12), false);
	assert.deepEqual(createGeneratedResources(
		{ constitution: 10, speed: 15 },
		10,
		5,
	), {
		hp: { current: 280, max: 280 },
		ar: { current: 14, max: 14 },
		ap: { current: 8, max: 8 },
		md: { current: 7.5, max: 7.5 },
	});
});

test('statistics and derived-stat recalculation preserve existing values', () => {
	const loaded = createStats({ speed: 12, initiative: 9 });
	assert.equal(loaded.initiative, 9);
	assert.equal(loaded.reflexes, 12);
	loaded.speed = 15;
	assert.equal(recalculateDerivedStats(loaded), loaded);
	assert.equal(loaded.initiative, 15);
	assert.equal(loaded.reflexes, 15);

	let seed = 12_345;
	const random = () => {
		seed = (seed * 1_664_525 + 1_013_904_223) % 4_294_967_296;
		return seed / 4_294_967_296;
	};
	const generated = generateStats({
		level: 10,
		profile: getStatProfile('character-balanced'),
		random,
	});
	assert.deepEqual(generated, {
		constitution: 12,
		strength: 7,
		dexterity: 14,
		intelligence: 14,
		speed: 16,
		perception: 11,
		charisma: 12,
		initiative: 16,
		reflexes: 16,
	});
	assert.equal(calculateStatCost(generated), calculateStatBudget(10));
	assert.equal(calculateRulePoints(14), 3);
	assert.deepEqual(allocateRuleLevels(6), [3]);
});

test('statistical profiles preserve minimums, maximums, weights, and legal remainders', () => {
	const minimums = Object.fromEntries(BASE_STATS.map(stat => [stat, 4]));
	const maximums = { ...minimums, constitution: 5, strength: 5 };
	const weights = Object.fromEntries(BASE_STATS.map(stat => [stat, 0]));
	weights.constitution = 1;
	weights.strength = 3;
	const profile = {
		id: 'test-weighted',
		minimums,
		maximums,
		weights,
	};
	assert.deepEqual(generateStats({ level: 1, profile, random: () => 0 }), {
		...minimums,
		constitution: 5,
		strength: 5,
		initiative: 4,
		reflexes: 4,
	});

	const onePointMinimums = Object.fromEntries(BASE_STATS.map(stat => [stat, 10]));
	onePointMinimums.charisma = 6;
	const onePointProfile = {
		id: 'test-weight-boundary',
		minimums: onePointMinimums,
		maximums: {
			...onePointMinimums,
			constitution: 11,
			strength: 11,
		},
		weights: { ...weights },
	};
	assert.equal(generateStats({
		level: 1,
		profile: onePointProfile,
		random: () => 0,
	}).constitution, 11);
	const boundarySelection = generateStats({
		level: 1,
		profile: onePointProfile,
		random: () => 0.25,
	});
	assert.equal(boundarySelection.constitution, 10);
	assert.equal(boundarySelection.strength, 11);

	const expensiveMinimums = Object.fromEntries(BASE_STATS.map(stat => [stat, 20]));
	const expensiveProfile = {
		id: 'test-expensive-minimums',
		minimums: expensiveMinimums,
		maximums: { ...expensiveMinimums },
		weights: Object.fromEntries(BASE_STATS.map(stat => [stat, 1])),
	};
	const expensive = generateStats({ level: 1, profile: expensiveProfile, random: () => 0 });
	for (const stat of BASE_STATS) {
		assert.equal(expensive[stat], 20);
	}

	const remainderProfile = {
		id: 'test-remainder',
		minimums: { ...minimums },
		maximums: { ...minimums, constitution: 15 },
		weights: { ...weights, strength: 0 },
	};
	const remainder = generateStats({
		level: 1,
		profile: remainderProfile,
		random: () => 0,
	});
	assert.equal(remainder.constitution, 15);
	assert.ok(calculateStatCost(remainder) < calculateStatBudget(1));
});

test('character validation preserves current save normalization and AP constraints', () => {
	assert.deepEqual(copyStringList(['valid', 2, null]), ['valid']);
	assert.deepEqual(copyTalentList('First\r\n- Second\n* Third\n\n'), [
		'First',
		'Second',
		'Third',
	]);
	assert.deepEqual(copyRules([
		{ name: 'Legacy', description: 2 },
		{ name: 'Valid', description: 'Description', level: 2 },
		null,
	]), [
		{ name: 'Legacy', description: '', level: 1 },
		{ name: 'Valid', description: 'Description', level: 2 },
	]);
	assert.deepEqual(createResourcesFromSave({
		ap: { current: 12, max: 11 },
	}), {
		hp: { current: 100, max: 100 },
		ar: { current: 0, max: 0 },
		ap: { current: 10, max: 10 },
		md: { current: 5, max: 5 },
	});

	const character = createCharacterFixture();
	assert.throws(
		() => validateActionPointEdit(character, ['resources', 'ap', 'max'], 11),
		error => error.code === 'INVALID_CHARACTER_EDIT',
	);
});

test('blank characters and hydrated saves use talent arrays', () => {
	const blankCharacter = new Character('Blank', 'creator');
	assert.deepEqual(blankCharacter.talents, []);

	const savedTalents = [
		'Athlete — +1 to sustained movement.',
		'Cold Immunity — Ordinary cold cannot freeze the character.',
	];
	const hydratedCharacter = Character.fromSave({
		schemaVersion: 3,
		creatorId: 'creator',
		key: 'Array.Save',
		talents: savedTalents,
	});
	assert.deepEqual(hydratedCharacter.talents, savedTalents);
	assert.notEqual(hydratedCharacter.talents, savedTalents);

	const legacyCharacter = Character.fromSave({
		schemaVersion: 3,
		creatorId: 'creator',
		key: 'Legacy.Save',
		talents: [
			'  Athlete — +1 to sustained movement.  ',
			'- Cold Immunity — Ordinary cold cannot freeze the character.',
			'',
			'* Keen Eye — +1 when searching for details.',
		].join('\r\n'),
	});
	assert.deepEqual(legacyCharacter.talents, [
		'Athlete — +1 to sustained movement.',
		'Cold Immunity — Ordinary cold cannot freeze the character.',
		'Keen Eye — +1 when searching for details.',
	]);
});

test('character encumbrance defaults each absent value and preserves explicit values', () => {
	const blankCharacter = new Character('Blank.Encumbrance', 'creator');
	assert.deepEqual(blankCharacter.gear.encumbrance, { current: 0, max: 0 });

	const missingEncumbrance = Character.fromSave({
		schemaVersion: 3,
		creatorId: 'creator',
		key: 'Missing.Encumbrance',
		statistics: { constitution: 20 },
	});
	assert.deepEqual(missingEncumbrance.gear.encumbrance, { current: 0, max: 0 });

	const missingMaximum = Character.fromSave({
		schemaVersion: 3,
		creatorId: 'creator',
		gear: { encumbrance: { current: 3 } },
		key: 'Missing.Maximum.Encumbrance',
		statistics: { constitution: 20 },
	});
	assert.deepEqual(missingMaximum.gear.encumbrance, { current: 3, max: 0 });

	const missingCurrent = Character.fromSave({
		schemaVersion: 3,
		creatorId: 'creator',
		gear: { encumbrance: { max: 8 } },
		key: 'Missing.Current.Encumbrance',
		statistics: { constitution: 20 },
	});
	assert.deepEqual(missingCurrent.gear.encumbrance, { current: 0, max: 8 });

	const explicitEncumbrance = Character.fromSave({
		schemaVersion: 3,
		creatorId: 'creator',
		gear: { encumbrance: { current: 4, max: 11 } },
		key: 'Explicit.Encumbrance',
		statistics: { constitution: 20 },
	});
	assert.deepEqual(explicitEncumbrance.gear.encumbrance, { current: 4, max: 11 });
});

test('random character generation leaves manual encumbrance unchanged', () => {
	const blankCharacter = new Character('Generated.Blank.Encumbrance', 'creator');
	populateRandomCharacter(blankCharacter, { level: 1, random: () => 0 });
	assert.deepEqual(blankCharacter.gear.encumbrance, { current: 0, max: 0 });

	const managedCharacter = new Character('Generated.Manual.Encumbrance', 'creator');
	managedCharacter.gear.encumbrance = { current: 4, max: 9 };
	populateRandomCharacter(managedCharacter, { level: 1, random: () => 0 });
	assert.deepEqual(managedCharacter.gear.encumbrance, { current: 4, max: 9 });
});

test('seeded random character generation remains equivalent', () => {
	const first = createCharacterFixture();
	const second = createCharacterFixture();
	populateRandomCharacter(first, { level: 10, random: createSeededRandom(12_345) });
	populateRandomCharacter(second, { level: 10, random: createSeededRandom(12_345) });
	assert.deepEqual(first, second);
});

test('character modifiers attach without changing generated base state', () => {
	const plain = createCharacterFixture();
	const modified = createCharacterFixture();
	populateRandomCharacter(plain, {
		level: 7,
		random: randomWithModifierChance(0.99),
		resolver: { resolveReference: () => ({ modifiers: [] }) },
	});
	populateRandomCharacter(modified, {
		level: 7,
		random: randomWithModifierChance(0),
		resolver: {
			resolveReference: () => ({
				fields: {
					name: 'Scarred',
					description: 'Old scars remain visible.',
				},
				provenance: [{
					type: 'entry',
					generatorId: 'modifier_character',
					entryId: 'scarred',
				}],
			}),
		},
	});
	const plainBase = structuredClone(plain);
	const modifiedBase = structuredClone(modified);
	assert.deepEqual(plainBase.status.modifiers, []);
	assert.equal(modifiedBase.status.modifiers[0].entryId, 'scarred');
	plainBase.status = { ...plainBase.status, modifiers: [] };
	modifiedBase.status = { ...modifiedBase.status, modifiers: [] };
	assert.deepEqual(modifiedBase, plainBase);
});

function randomWithModifierChance(chance) {
	let calls = 0;
	return () => {
		calls += 1;
		return calls === 6 ? chance : 0;
	};
}

test('random character generation creates localized unique talent arrays by level', () => {
	const talentCounts = new Map([
		[1, 1],
		[2, 1],
		[3, 2],
		[5, 2],
		[6, 3],
		[8, 3],
		[9, 4],
		[10, 4],
	]);

	for (const locale of ['en', 'fr']) {
		for (const [level, expectedCount] of talentCounts) {
			const character = createCharacterFixture();
			populateRandomCharacter(character, {
				level,
				locale,
				random: () => 0,
			});

			assert.equal(calculateTalentCount(level), expectedCount, `${locale} level ${level}`);
			assert.equal(character.talents.length, expectedCount, `${locale} level ${level}`);
			assert.equal(
				new Set(character.talents).size,
				expectedCount,
				`${locale} level ${level}`,
			);
			assert.equal(
				character.talents.every(talent => typeof talent === 'string' && talent),
				true,
				`${locale} level ${level}`,
			);
		}
	}

	const englishCharacter = createCharacterFixture();
	populateRandomCharacter(englishCharacter, {
		level: 1,
		locale: 'en',
		random: () => 0,
	});
	const frenchCharacter = createCharacterFixture();
	populateRandomCharacter(frenchCharacter, {
		level: 1,
		locale: 'fr',
		random: () => 0,
	});
	assert.match(englishCharacter.talents[0], /^Athlete —/);
	assert.match(frenchCharacter.talents[0], /^Athlète —/);
});

test('random character generation uses localized content without changing identifiers', () => {
	const character = createCharacterFixture();
	populateRandomCharacter(character, createLocalizedCharacterGenerationOptions({
		background: 'criminal',
		level: 1,
		random: () => 0,
	}, 'fr'));

	assert.equal(character.race.name, 'Humain');
	assert.match(character.gear.inventory.at(-1), /^\d+ pièces d’or$/);
	assert.equal(character.gear.inventory.some(item => item.endsWith(' gold')), false);
	assert.ok(character.background.archetype);
	assert.ok(character.background.physicalDescription);
	assert.equal(character.background.backstory, '');
	assert.equal(character.background.goals, '');
});

function createCharacterFixture() {
	return new Character('Test', 'dm');
}

function createSeededRandom(initialSeed) {
	let seed = initialSeed;
	return () => {
		seed = (seed * 1_664_525 + 1_013_904_223) % 4_294_967_296;
		return seed / 4_294_967_296;
	};
}

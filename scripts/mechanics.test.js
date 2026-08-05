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
const {
	createLocalizedCharacterGenerationOptions,
} = require('../util/characterGenerationLocalization');

test('damage preserves AR-first and piercing behavior', () => {
	const character = createCharacterFixture();
	character.status.hp.current = 100;
	character.status.ar.current = 30;

	assert.deepEqual(dealDamage(character, 40), {
		arDamage: 30,
		hpDamage: 10,
		piercing: false,
	});
	assert.equal(character.status.ar.current, 0);
	assert.equal(character.status.hp.current, 90);

	character.status.ar.current = 20;
	assert.deepEqual(dealDamage(character, 15, true), {
		arDamage: 0,
		hpDamage: 15,
		piercing: true,
	});
	assert.equal(character.status.ar.current, 20);
	assert.equal(character.status.hp.current, 75);
	assert.throws(
		() => dealDamage(character, 0),
		error => error.code === 'INVALID_CHARACTER_EDIT',
	);
});

test('healing restores HP, armor, or both with shared rounding', () => {
	const character = createCharacterFixture();
	character.status.hp = { current: 1, max: 101 };
	character.status.ar = { current: 0, max: 33 };
	character.status.ap = { current: 0, max: 6 };
	character.status.md = { current: 0, max: 7.5 };

	assert.deepEqual(restoreResource(character, 'hp', 50), { current: 51, max: 101 });
	assert.deepEqual(restoreResource(character, 'ar', 25), { current: 8, max: 33 });
	assert.deepEqual(restoreHealingResources(character, 'hp', 25), [
		{ resource: 'hp', previous: 51, current: 25, max: 101 },
	]);
	assert.deepEqual(restoreHealingResources(character, 'armor', 50), [
		{ resource: 'ar', previous: 8, current: 17, max: 33 },
	]);
	character.status.hp.current = 10;
	character.status.ar.current = 5;
	assert.deepEqual(restoreHealingResources(character, 'both', 50), [
		{ resource: 'hp', previous: 10, current: 51, max: 101 },
		{ resource: 'ar', previous: 5, current: 17, max: 33 },
	]);
	assert.equal(calculateRestoredResourceValue(101, 100), 101);
	assert.equal(character.status.hp.current <= character.status.hp.max, true);
	assert.equal(character.status.ar.current <= character.status.ar.max, true);

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
	assert.equal(character.status.ap.current, 6);
	assert.equal(character.status.md.current, 7.5);
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
	const generated = generateStats(10, random);
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

test('character validation preserves legacy save normalization and AP constraints', () => {
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
		() => validateActionPointEdit(character, ['status', 'ap', 'max'], 11),
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
		schemaVersion: 2,
		creatorId: 'creator',
		key: 'Array.Save',
		talents: savedTalents,
	});
	assert.deepEqual(hydratedCharacter.talents, savedTalents);
	assert.notEqual(hydratedCharacter.talents, savedTalents);

	const legacyCharacter = Character.fromSave({
		schemaVersion: 1,
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
		schemaVersion: 2,
		creatorId: 'creator',
		key: 'Missing.Encumbrance',
		statistics: { constitution: 20 },
	});
	assert.deepEqual(missingEncumbrance.gear.encumbrance, { current: 0, max: 0 });

	const missingMaximum = Character.fromSave({
		schemaVersion: 2,
		creatorId: 'creator',
		gear: { encumbrance: { current: 3 } },
		key: 'Missing.Maximum.Encumbrance',
		statistics: { constitution: 20 },
	});
	assert.deepEqual(missingMaximum.gear.encumbrance, { current: 3, max: 0 });

	const missingCurrent = Character.fromSave({
		schemaVersion: 2,
		creatorId: 'creator',
		gear: { encumbrance: { max: 8 } },
		key: 'Missing.Current.Encumbrance',
		statistics: { constitution: 20 },
	});
	assert.deepEqual(missingCurrent.gear.encumbrance, { current: 0, max: 8 });

	const explicitEncumbrance = Character.fromSave({
		schemaVersion: 2,
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
	let seed = 12_345;
	const random = () => {
		seed = (seed * 1_664_525 + 1_013_904_223) % 4_294_967_296;
		return seed / 4_294_967_296;
	};
	const character = createCharacterFixture();
	populateRandomCharacter(character, { level: 10, random });

	assert.deepEqual({
		statistics: character.statistics,
		rules: character.rules.map(rule => ({ name: rule.name, level: rule.level })),
		status: character.status,
		gear: character.gear,
	}, {
		statistics: {
			constitution: 10,
			strength: 7,
			dexterity: 15,
			intelligence: 14,
			speed: 15,
			perception: 12,
			charisma: 13,
			initiative: 15,
			reflexes: 15,
		},
		rules: [{ name: 'Shadow RULE', level: 2 }],
		status: {
			hp: { current: 280, max: 280 },
			ar: { current: 14, max: 14 },
			ap: { current: 8, max: 8 },
			md: { current: 7.5, max: 7.5 },
			effects: [
				'Fatigued — prolonged effort and travel are more difficult until resting.',
			],
		},
		gear: {
			equipment: [
				'Common light armor — Ordinary clothing or light padding that offers mobility but no meaningful AR.',
				'Hand axe — A compact chopping weapon balanced well enough to throw.',
				'Greatsword — A massive two-handed sword designed for broad, forceful attacks.',
			],
			inventory: [
				'Bedroll — A weather-resistant blanket and sleeping roll.',
				'Chalk and charcoal — Useful for marking paths, sketching maps, and making notes.',
				'Manacles — A pair of iron restraints with a simple key.',
				'175 gold',
			],
			encumbrance: { current: 0, max: 0 },
		},
	});
});

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
	assert.ok(character.background.appearance);
	assert.ok(character.background.backstory);
	assert.ok(character.background.goals);
});

function createCharacterFixture() {
	return new Character('Test', 'dm');
}

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
	calculateArmorRating,
	canEquipArmor,
} = require('../services/mechanics/armor');
const {
	copyRules,
	copyStringList,
	validateActionPointEdit,
} = require('../services/mechanics/characterValidation');
const {
	allocateRuleLevels,
	calculateRulePoints,
	calculateStatBudget,
	calculateStatCost,
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
	assert.deepEqual(copyRules([
		{ name: 'Legacy', description: 2 },
		{ name: 'Valid', description: 'Description', level: 2 },
		null,
	]), [
		{ name: 'Legacy', description: '', level: 1 },
		{ name: 'Valid', description: 'Description', level: 2 },
	]);
	assert.deepEqual(createResourcesFromSave({
		resources: {
			ap: { current: 12, max: 11 },
		},
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

test('seeded random character generation remains equivalent', () => {
	let seed = 12_345;
	const random = () => {
		seed = (seed * 1_664_525 + 1_013_904_223) % 4_294_967_296;
		return seed / 4_294_967_296;
	};
	const character = createCharacterFixture();
	populateRandomCharacter(character, { level: 10, random });

	assert.deepEqual({
		stats: character.stats,
		rules: character.rules.map(rule => ({ name: rule.name, level: rule.level })),
		resources: character.resources,
		equipment: character.equipment,
		inventory: character.inventory,
		encumbrance: character.encumbrance,
		statusEffects: character.statusEffects,
	}, {
		stats: {
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
		resources: {
			hp: { current: 280, max: 280 },
			ar: { current: 14, max: 14 },
			ap: { current: 8, max: 8 },
			md: { current: 7.5, max: 7.5 },
		},
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
		encumbrance: { current: 5, max: 10 },
		statusEffects: [
			'Fatigued — prolonged effort and travel are more difficult until resting.',
		],
	});
});

test('random character generation uses localized content without changing identifiers', () => {
	const character = createCharacterFixture();
	populateRandomCharacter(character, createLocalizedCharacterGenerationOptions({
		background: 'criminal',
		level: 1,
		random: () => 0,
	}, 'fr'));

	assert.equal(character.race.name, 'Humain');
	assert.match(character.inventory.at(-1), /^\d+ pièces d’or$/);
	assert.equal(character.inventory.some(item => item.endsWith(' gold')), false);
	assert.ok(character.appearance);
	assert.ok(character.backstory);
	assert.ok(character.goals);
});

function createCharacterFixture() {
	return {
		key: 'Test',
		creatorId: 'dm',
		firstName: '',
		lastName: '',
		level: 1,
		race: { name: '', physicalDescription: '', lore: '' },
		appearance: '',
		backstory: '',
		goals: '',
		personality: { traits: [], description: '' },
		racialTraits: { skillBonus: '', physicalAbility: '' },
		stats: createStats(),
		rules: [],
		talents: '',
		resources: {
			hp: { current: 100, max: 100 },
			ar: { current: 0, max: 0 },
			ap: { current: 4, max: 4 },
			md: { current: 5, max: 5 },
		},
		statusEffects: [],
		equipment: [],
		inventory: [],
		encumbrance: { current: 0, max: 10 },
	};
}

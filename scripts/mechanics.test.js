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
const {
	calculateGeneratedArmorPercentage,
	pickCarriedLoot,
	pickMainEquipment,
	populateRandomCharacter,
	selectMainEquipmentGenerator,
} = require('../services/randomCharacterGenerator');
const generatorCatalog = require('../services/generatorCatalog');
const generatorResolver = require('../services/generatorResolver');
const { getStatProfile } = require('../services/statProfileCatalog');
const { DEFAULT_STAT_PROFILE_ID } = require('../services/generationMetadata');
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
		profile: getStatProfile(DEFAULT_STAT_PROFILE_ID),
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

test('character validation preserves save list trimming and AP constraints', () => {
	assert.deepEqual(copyStringList(['valid', 2, null]), ['valid']);
	assert.deepEqual(copyTalentList('First\r\n- Second\n* Third\n\n'), [
		'First',
		'- Second',
		'* Third',
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

	const hydratedTextCharacter = Character.fromSave({
		schemaVersion: 3,
		creatorId: 'creator',
		key: 'Text.Save',
		talents: [
			'  Athlete — +1 to sustained movement.  ',
			'- Cold Immunity — Ordinary cold cannot freeze the character.',
			'',
			'* Keen Eye — +1 when searching for details.',
		].join('\r\n'),
	});
	assert.deepEqual(hydratedTextCharacter.talents, [
		'Athlete — +1 to sustained movement.',
		'- Cold Immunity — Ordinary cold cannot freeze the character.',
		'* Keen Eye — +1 when searching for details.',
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

test('main equipment rolls weapon and shield types independently at the 80 percent boundary', () => {
	assert.equal(selectMainEquipmentGenerator(() => 0), 'weapons');
	assert.equal(selectMainEquipmentGenerator(() => 0.799999), 'weapons');
	assert.equal(selectMainEquipmentGenerator(() => 0.8), 'shields');
	assert.equal(selectMainEquipmentGenerator(() => 0.999999), 'shields');

	for (const [count, randomValues, expected] of [
		[1, [0, 0], ['weapons']],
		[1, [0.8, 0], ['shields']],
		[2, [0, 0, 0, 0], ['weapons', 'weapons']],
		[2, [0, 0.8, 0, 0], ['weapons', 'shields']],
		[2, [0.8, 0.8, 0, 0], ['shields', 'shields']],
	]) {
		const equipment = pickMainEquipment(
			count,
			'en',
			sequenceRandom(randomValues),
		);
		assert.deepEqual(equipment.map(item => item.generatorId), expected);
		for (const generatorId of new Set(expected)) {
			const entries = equipment
				.filter(item => item.generatorId === generatorId)
				.map(item => item.entry.id);
			assert.equal(new Set(entries).size, entries.length);
		}
	}
});

test('equipped shield AR stacks while carried shield loot remains non-mechanical', () => {
	const armor = { fields: { ar_percentage: 35 } };
	const equipment = [
		{ generatorId: 'shields', entry: { fields: { ar_percentage: 10 } } },
		{ generatorId: 'shields', entry: { fields: { ar_percentage: 5 } } },
		{ generatorId: 'weapons', entry: { fields: {} } },
	];
	assert.equal(calculateGeneratedArmorPercentage(armor, equipment), 50);

	const resolver = {
		generate(path, locale, options) {
			if (path === 'loot.generator') {
				return {
					outputType: 'value',
					value: 'Legendary carried shield \u2014 25% AR when equipped.',
					provenance: [
						{ type: 'entry', generatorId: 'loot', entryId: 'shields' },
						{ type: 'entry', generatorId: 'shields', entryId: 'carried' },
					],
				};
			}
			return generatorResolver.generate(path, locale, options);
		},
		resolveReference(reference, locale, options) {
			if (reference.generator === 'loot') {
				return {
					value: 'Legendary carried shield — 25% AR when equipped.',
					provenance: [
						{ type: 'entry', generatorId: 'loot', entryId: 'shields' },
						{ type: 'entry', generatorId: 'shields', entryId: 'carried' },
					],
				};
			}
			return generatorResolver.resolveReference(reference, locale, options);
		},
		resolveInlineReference: generatorResolver.resolveInlineReference,
	};
	const character = createCharacterFixture();
	populateRandomCharacter(character, {
		level: 10,
		random: () => 0.999999,
		resolver,
	});
	const armorEntry = findNamedEquipmentEntry(
		generatorCatalog.getGenerator('armors'),
		character.gear.equipment[0],
	);
	const equippedShields = character.gear.equipment.slice(1).map(value => (
		findNamedEquipmentEntry(generatorCatalog.getGenerator('shields'), value)
	));
	assert.equal(equippedShields.every(Boolean), true);
	const expectedPercentage = Number(armorEntry.fields.ar_percentage)
		+ equippedShields.reduce((total, shield) => (
			total + Number(shield.fields.ar_percentage)
		), 0);
	assert.equal(
		character.resources.ar.max,
		Math.round(character.resources.hp.max * expectedPercentage / 100),
	);
	assert.equal(character.gear.inventory.length, 4);
	assert.equal(
		character.gear.inventory.slice(0, 3).every(value => value.startsWith('Legendary carried')),
		true,
	);
});

test('carried loot uses heterogeneous display results and bounded provenance deduplication', () => {
	const results = [
		lootResult('weapons', 'short_sword', 'Short sword — A practical blade.'),
		lootResult('weapons', 'short_sword', 'Short sword — A practical blade.'),
		lootResult('material', 'iron', 'Iron — Common crafting metal.'),
		lootResult('shields', 'common_buckler', 'Buckler — A compact shield.'),
	];
	let calls = 0;
	const resolver = {
		generate() {
			const result = results[Math.min(calls, results.length - 1)];
			calls += 1;
			return result;
		},
	};
	assert.deepEqual(
		pickCarriedLoot(3, 'en', () => 0, resolver),
		[
			'Short sword — A practical blade.',
			'Iron — Common crafting metal.',
			'Buckler — A compact shield.',
		],
	);
	assert.equal(calls, 4);

	let repeatedCalls = 0;
	const repeated = {
		generate() {
			repeatedCalls += 1;
			return lootResult('curio', 'unknown_key', 'Unknown key — Its lock is unknown.');
		},
	};
	assert.equal(pickCarriedLoot(3, 'en', () => 0, repeated).length, 3);
	assert.equal(repeatedCalls, 21);
});

test('structured carried loot uses a proper em dash separator', () => {
	const resolver = {
		generate() {
			return {
				outputType: 'fields',
				displayFields: {
					name: 'Buckler',
					description: 'A compact shield.',
				},
				provenance: [
					{ type: 'entry', generatorId: 'loot', entryId: 'shields' },
					{ type: 'entry', generatorId: 'shields', entryId: 'buckler' },
				],
			};
		},
	};
	const [value] = pickCarriedLoot(1, 'en', () => 0, resolver);
	assert.equal(value, 'Buckler \u2014 A compact shield.');
	assert.equal(value.includes('\u00e2\u20ac\u201d'), false);
});

test('seeded random character generation remains equivalent', () => {
	const first = createCharacterFixture();
	const second = createCharacterFixture();
	populateRandomCharacter(first, { level: 10, random: createSeededRandom(12_345) });
	populateRandomCharacter(second, { level: 10, random: createSeededRandom(12_345) });
	assert.deepEqual(first, second);
});

test('random character statistics use the individually selected background archetype profile', () => {
	const archetypeProfiles = new Map([
		['soldier', 'character-fighter'],
		['military_engineer', 'character-mage'],
		['quartermaster', 'character-diplomat'],
		['military_scout', 'character-rogue'],
	]);
	for (const locale of ['en', 'fr']) {
		for (const [entryId, profileId] of archetypeProfiles) {
			const entry = generatorCatalog.getGenerator('military', locale).entries
				.find(candidate => candidate.id === entryId);
			assert.equal(entry.generation.statProfile, profileId);
			const resolver = {
				generate(traversalPath, resolvedLocale, options) {
					if (traversalPath === 'background:military.generator') {
						return {
							generatorId: 'military',
							entryId,
							outputType: 'value',
							value: entry.name,
							provenance: [],
							modifiers: [],
						};
					}
					return generatorResolver.generate(traversalPath, resolvedLocale, options);
				},
				resolveReference: generatorResolver.resolveReference,
				resolveInlineReference: generatorResolver.resolveInlineReference,
			};
			const character = createCharacterFixture();
			populateRandomCharacter(character, {
				background: 'military',
				level: 10,
				locale,
				random: () => 0.61,
				resolver,
			});
			assert.deepEqual(
				character.statistics,
				generateStats({
					level: 10,
					profile: getStatProfile(profileId),
					random: () => 0.61,
				}),
				`${locale}:${entryId}`,
			);
		}
	}
});

test('character modifiers attach without changing generated base state', () => {
	const plain = createCharacterFixture();
	const modified = createCharacterFixture();
	populateRandomCharacter(plain, {
		level: 7,
		random: randomWithModifierChance(0.99),
		resolver: createCharacterModifierResolver({ modifiers: [] }),
	});
	populateRandomCharacter(modified, {
		level: 7,
		random: randomWithModifierChance(0),
		resolver: createCharacterModifierResolver({
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

function createCharacterModifierResolver(modifierResult) {
	return {
		generate: generatorResolver.generate,
		resolveReference(reference, locale, options) {
			if (reference.generator === 'modifier_character') {
				return structuredClone(modifierResult);
			}
			return generatorResolver.resolveReference(reference, locale, options);
		},
		resolveInlineReference: generatorResolver.resolveInlineReference,
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

test('character generation metadata replaces normal categories and stacks equipped AR', () => {
	const backgroundRoute = generatorCatalog.getGenerator('background', 'en').entries
		.find(route => generatorCatalog.getGenerator(route.generator, 'en').entries
			.some(entry => entry.generation === undefined));
	const backgroundGenerator = structuredClone(
		generatorCatalog.getGenerator(backgroundRoute.generator, 'en'),
	);
	const archetype = backgroundGenerator.entries.find(entry => (
		entry.generation === undefined
	));
	archetype.generation = {
		naturalArmorPercentage: 20,
		talents: ['Gifted: {{ talents:athlete }}'],
		fixedRules: [{ entry: 'thread_rule', level: 2 }],
		statusEffects: [{
			generator: 'status_effect',
			entry: 'bruised',
			select: 'fields',
		}],
		modifiers: [{
			generator: 'modifier_character',
			entry: 'scarred',
			select: 'fields',
		}],
		armor: {
			generator: 'armors',
			entry: 'common_light_armor',
			select: 'fields',
		},
		equipment: [{
			generator: 'shields',
			entry: 'common_buckler',
			select: 'display',
		}],
		inventory: [{
			generator: 'shields',
			entry: 'wooden_shield',
			select: 'fields',
		}],
	};
	const profileRequests = [];
	const resolver = {
		generate(path, locale, options) {
			if (path === `background:${backgroundRoute.id}.generator`) {
				return {
					generatorId: backgroundGenerator.id,
					entryId: archetype.id,
					outputType: 'value',
					value: archetype.name,
					provenance: [],
					modifiers: [],
				};
			}
			return generatorResolver.generate(path, locale, options);
		},
		resolveInlineReference: generatorResolver.resolveInlineReference,
		resolveInlineString: generatorResolver.resolveInlineString,
		resolveReference: generatorResolver.resolveReference,
	};
	const character = createCharacterFixture();
	populateRandomCharacter(character, {
		background: backgroundRoute.id,
		getGenerator: (generatorId, locale) => (
			generatorId === backgroundGenerator.id
				? backgroundGenerator
				: generatorCatalog.getGenerator(generatorId, locale)
		),
		getStatProfile(profileId) {
			profileRequests.push(profileId);
			return getStatProfile(profileId);
		},
		level: 5,
		locale: 'en',
		random: () => 0,
		resolver,
	});

	assert.deepEqual(profileRequests, [DEFAULT_STAT_PROFILE_ID]);
	assert.deepEqual(character.rules.map(rule => [rule.name, rule.level]), [
		['Thread RULE', 2],
	]);
	assert.equal(character.talents.length, 1);
	assert.match(character.talents[0], /^Gifted: Athlete —/);
	assert.deepEqual(character.status.effects.map(effect => effect.entryId), ['bruised']);
	assert.deepEqual(character.status.modifiers.map(modifier => modifier.entryId), [
		'scarred',
	]);
	assert.equal(character.gear.equipment.length, 2);
	assert.equal(character.gear.inventory.length, 1);
	assert.equal(character.gear.inventory.some(item => item.endsWith(' gold')), false);
	assert.equal(
		character.resources.ar.max,
		calculateArmorRating(character.resources.hp.max, 30),
	);
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

function sequenceRandom(values) {
	let index = 0;
	return () => values[Math.min(index++, values.length - 1)];
}

function findNamedEquipmentEntry(generator, value) {
	const name = value.split(' — ')[0];
	return generator.entries.find(entry => entry.name === name);
}

function lootResult(generatorId, entryId, value) {
	return {
		outputType: 'value',
		value,
		provenance: [
			{ type: 'entry', generatorId: 'loot', entryId: generatorId },
			{ type: 'entry', generatorId, entryId },
		],
	};
}

const assert = require('node:assert/strict');
const { test } = require('node:test');
const Character = require('../models/Character');
const {
	ARMOR_CONSTITUTION_REQUIREMENTS,
	ARMOR_PERCENTAGES,
	SHIELD_PERCENTAGES,
	calculateArmorRating,
	canEquipArmor,
	getArmorPercentage,
	getShieldPercentage,
} = require('../services/mechanics/armor');
const {
	formatResolvedLootItem,
	getResolvedLootArmorPercentage,
} = require('../services/lootGeneration');
const {
	validateActionPointEdit,
} = require('../services/mechanics/characterValidation');
const {
	allocateRuleLevels,
	calculateRulePoints,
	calculateTalentCount,
} = require('../services/mechanics/characterGeneration');
const { dealDamage } = require('../services/mechanics/damage');
const { BASE_STATS } = require('../services/mechanics/constants');
const {
	calculateMaxAp,
	calculateMaxHp,
	calculateMaxMovementDistance,
	calculateRestoredResourceValue,
	createGeneratedResources,
	resetTurnResources,
	restoreHealingResources,
	restoreResource,
} = require('../services/mechanics/resources');
const {
	createStats,
	recalculateDerivedStats,
} = require('../services/mechanics/statistics');
const {
	calculateStatBudget,
	calculateStatCost,
	generateStats,
} = require('../services/mechanics/statGeneration');
const {
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
	assert.deepEqual(ARMOR_CONSTITUTION_REQUIREMENTS, {
		light: 0,
		medium: 12,
		heavy: 14,
	});
	assert.equal(canEquipArmor(0, 'light'), true);
	assert.equal(canEquipArmor(12, 'medium'), true);
	assert.equal(canEquipArmor(11, 'medium'), false);
	assert.equal(canEquipArmor(14, 'heavy'), true);
	assert.equal(canEquipArmor(13, 'heavy'), false);
	assert.equal(canEquipArmor(20, 'unknown'), false);
	assert.deepEqual(ARMOR_PERCENTAGES, {
		light: { common: 5, uncommon: 15, rare: 25, epic: 35, legendary: 45 },
		medium: { common: 25, uncommon: 35, rare: 45, epic: 55, legendary: 65 },
		heavy: { common: 45, uncommon: 55, rare: 65, epic: 75, legendary: 85 },
	});
	assert.deepEqual(SHIELD_PERCENTAGES, {
		common: 5,
		uncommon: 10,
		rare: 15,
		epic: 20,
		legendary: 25,
	});
	assert.equal(getArmorPercentage('heavy', 'legendary'), 85);
	assert.equal(getShieldPercentage('epic'), 20);
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

test('character validation preserves AP constraints', () => {
	const character = createCharacterFixture();
	assert.throws(
		() => validateActionPointEdit(character, ['resources', 'ap', 'max'], 11),
		error => error.code === 'INVALID_CHARACTER_EDIT',
	);
});

test('blank characters and hydrated saves use validated talent arrays', () => {
	const blankCharacter = new Character('Blank');
	assert.deepEqual(blankCharacter.talents, []);

	const savedTalents = [
		'Athlete — +1 to sustained movement.',
		'Cold Immunity — Ordinary cold cannot freeze the character.',
	];
	const saved = JSON.parse(JSON.stringify(new Character('Array.Save')));
	saved.talents = savedTalents;
	const hydratedCharacter = Character.fromSave(saved);
	assert.deepEqual(hydratedCharacter.talents, savedTalents);
	assert.notEqual(hydratedCharacter.talents, savedTalents);

	const malformed = JSON.parse(JSON.stringify(new Character('Text.Save')));
	malformed.talents = 'Athlete — +1 to sustained movement.';
	assert.throws(
		() => Character.fromSave(malformed),
		error => error.code === 'INVALID_CHARACTER_SAVE',
	);
});

test('character hydration rejects incomplete resources and preserves explicit encumbrance', () => {
	const blankCharacter = new Character('Blank.Encumbrance');
	assert.deepEqual(blankCharacter.gear.encumbrance, { current: 0, max: 0 });

	const incomplete = JSON.parse(JSON.stringify(blankCharacter));
	delete incomplete.gear.encumbrance.current;
	assert.throws(
		() => Character.fromSave(incomplete),
		error => error.code === 'INVALID_CHARACTER_SAVE',
	);

	const saved = JSON.parse(JSON.stringify(new Character('Explicit.Encumbrance')));
	saved.gear.encumbrance = { current: 4, max: 11 };
	const explicitEncumbrance = Character.fromSave(saved);
	assert.deepEqual(explicitEncumbrance.gear.encumbrance, { current: 4, max: 11 });
});

test('random character generation leaves manual encumbrance unchanged', () => {
	const blankCharacter = new Character('Generated.Blank.Encumbrance');
	populateRandomCharacter(blankCharacter, { level: 1, random: () => 0 });
	assert.deepEqual(blankCharacter.gear.encumbrance, { current: 0, max: 0 });

	const managedCharacter = new Character('Generated.Manual.Encumbrance');
	managedCharacter.gear.encumbrance = { current: 4, max: 9 };
	populateRandomCharacter(managedCharacter, { level: 1, random: () => 0 });
	assert.deepEqual(managedCharacter.gear.encumbrance, { current: 4, max: 9 });
});

test('default character armor, equipment, and carried loot preserve every loot modifier', () => {
	const character = createCharacterFixture();
	populateRandomCharacter(character, { level: 1, random: () => 0 });
	const generatedItems = [
		...character.gear.equipment,
		...character.gear.inventory.slice(0, -1),
	];
	assert.ok(generatedItems.length >= 5);
	assert.match(character.gear.equipment[0], /^.+ \((?:Light|Medium|Heavy)\) — /);
	for (const item of generatedItems) {
		assert.match(item, / — Common — Made of [^—]+ — Runed — /);
	}
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

test('stable rarity modifier IDs drive armor mechanics and readable flattening order', () => {
	const rarity = {
		entryId: 'epic',
		generatorId: 'modifier_rarity',
		outputType: 'value',
		value: 'Epic',
	};
	const material = {
		entryId: 'made_of_material',
		generatorId: 'modifier_material',
		outputType: 'value',
		value: 'Made of Iron',
	};
	const lootModifier = {
		entryId: 'runed',
		generatorId: 'modifier_loot',
		outputType: 'fields',
		displayFields: {
			name: 'Runed',
			description: 'A GM-defined rune marks the item.',
		},
	};
	const armor = {
		entryId: 'breastplate',
		generatorId: 'armors',
		fields: { type: 'medium' },
		displayFields: {
			name: 'Breastplate',
			description: 'A shaped rigid cuirass.',
			type: 'medium',
		},
		modifiers: [lootModifier, material, rarity],
	};
	assert.equal(getResolvedLootArmorPercentage(armor), 55);
	assert.equal(getResolvedLootArmorPercentage({
		...armor,
		generatorId: 'shields',
	}), 20);
	assert.equal(getResolvedLootArmorPercentage({
		...armor,
		generatorId: 'weapons',
	}), 0);
	assert.equal(
		formatResolvedLootItem(armor),
		'Breastplate (Medium) — A shaped rigid cuirass. — Epic — Made of Iron — '
			+ 'Runed — A GM-defined rune marks the item.',
	);
	assert.equal(
		formatResolvedLootItem({
			...armor,
			displayFields: {
				...armor.displayFields,
				name: 'Cuirasse',
				description: 'Une cuirasse rigide et ajustée.',
			},
		}, 'fr'),
		'Cuirasse (Moyenne) — Une cuirasse rigide et ajustée. — Epic — Made of Iron — '
			+ 'Runed — A GM-defined rune marks the item.',
	);
});

test('carried loot uses heterogeneous display results and bounded provenance deduplication', () => {
	const results = [
		lootResult('weapons', 'short_sword', 'Short sword — A practical blade.'),
		lootResult('weapons', 'short_sword', 'Short sword — A practical blade.'),
		lootResult('material', 'iron', 'Iron — Common crafting metal.'),
		lootResult('shields', 'buckler', 'Buckler — A compact shield.'),
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
			for (const background of [
				`military:${entryId}`,
				`military.generator:${entryId}`,
			]) {
				const character = createCharacterFixture();
				populateRandomCharacter(character, {
					background,
					level: 10,
					locale,
					random: () => 0.61,
				});
				assert.deepEqual(
					character.statistics,
					generateStats({
						level: 10,
						profile: getStatProfile(profileId),
						random: () => 0.61,
					}),
					`${locale}:${background}`,
				);
			}
		}
	}
});

test('/gen-character background rejects field terminals before archetype generation', () => {
	let randomCalls = 0;
	assert.throws(
		() => populateRandomCharacter(createCharacterFixture(), {
			background: 'criminal:smuggler.name',
			level: 1,
			random() {
				randomCalls += 1;
				return 0;
			},
		}),
		error => error.translationKey === 'errors.backgroundUnknown',
	);
	assert.equal(randomCalls, 0);
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
			generatorId: 'modifier_character',
			entryId: 'scarred',
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

test('Race Hybrid selects a secondary race different from the generated base race', () => {
	const backgroundRoute = generatorCatalog.getGenerator('background', 'en').entries[0];
	const backgroundGenerator = structuredClone(
		generatorCatalog.getGenerator(backgroundRoute.generator, 'en'),
	);
	const archetype = backgroundGenerator.entries[0];
	archetype.generation = {
		...(archetype.generation ?? {}),
		modifiers: ['modifier_character:race_hybrid'],
	};
	const getGenerator = (generatorId, locale) => (
		generatorId === backgroundGenerator.id
			? backgroundGenerator
			: generatorCatalog.getGenerator(generatorId, locale)
	);
	const resolver = generatorResolver.createGeneratorResolver({ getGenerator });
	const character = createCharacterFixture();
	populateRandomCharacter(character, {
		background: `${backgroundRoute.id}:${archetype.id}`,
		getGenerator,
		level: 1,
		random: () => 0,
		resolver,
	});

	assert.equal(character.race.name, 'Human');
	assert.equal(character.status.modifiers[0].entryId, 'race_hybrid');
	assert.match(character.status.modifiers[0].description, /\bElf\b/);
	const secondaryRace = character.status.modifiers[0].provenance
		.find(record => record.generatorId === 'race');
	assert.equal(secondaryRace.entryId, 'elf');
	assert.notEqual(secondaryRace.entryId, 'human');
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
			if (reference === 'modifier_character') {
				return structuredClone(modifierResult);
			}
			return generatorResolver.resolveReference(reference, locale, options);
		},
		resolveInlineReference: generatorResolver.resolveInlineReference,
		resolveInlineString: generatorResolver.resolveInlineString,
	};
}

test('default random character talents resolve selected inline references without rerolling', () => {
	for (const locale of ['en', 'fr']) {
		for (const talentId of [
			'weapon_specialist',
			'monster_hunter',
			'cultural_expert',
		]) {
			const { options, resolvedReferences } = createReferenceResolutionOptions(locale);
			const character = createCharacterFixture();
			populateRandomCharacter(character, {
				...options,
				random: sequenceRandom([
					0,
					0,
					0,
					0,
					0,
					getWeightedEntryMidpoint('talents', talentId, locale),
					0,
					0.5,
				]),
			});

			const expected = generatorResolver.resolveReference(
				`talents:${talentId}`,
				locale,
				{ random: () => 0 },
			).display;
			assert.deepEqual(character.talents, [expected]);
			assert.doesNotMatch(character.talents[0], /\{\{|\}\}/);
			assert.deepEqual(
				resolvedReferences.filter(reference => reference.startsWith('talents:')),
				[`talents:${talentId}`],
			);
		}
	}
});

test('default random character status effects resolve selected inline references without rerolling', () => {
	for (const locale of ['en', 'fr']) {
		for (const statusEffectId of ['grappled', 'hunted', 'bestial_mutation']) {
			const { options, resolvedReferences } = createReferenceResolutionOptions(locale);
			const character = createCharacterFixture();
			populateRandomCharacter(character, {
				...options,
				random: sequenceRandom([
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					getWeightedEntryMidpoint(
						'status_effect',
						statusEffectId,
						locale,
					),
					0,
					0,
				]),
			});

			const expected = generatorResolver.resolveReference(
				`status_effect:${statusEffectId}`,
				locale,
				{ random: () => 0 },
			).displayFields;
			assert.deepEqual(character.status.effects, [{
				name: expected.name,
				description: expected.description,
			}]);
			assert.doesNotMatch(
				`${character.status.effects[0].name} ${character.status.effects[0].description}`,
				/\{\{|\}\}/,
			);
			assert.deepEqual(
				resolvedReferences.filter(reference => (
					reference.startsWith('status_effect:')
				)),
				[`status_effect:${statusEffectId}`],
			);
		}
	}
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
		statusEffects: ['status_effect:bruised'],
		modifiers: ['modifier_character:scarred'],
		armor: 'armors:padded_armor',
		equipment: ['shields:buckler'],
		inventory: ['shields:round_shield'],
	};
	const profileRequests = [];
	const resolver = generatorResolver.createGeneratorResolver({
		getGenerator: (generatorId, locale) => (
			generatorId === backgroundGenerator.id
				? backgroundGenerator
				: generatorCatalog.getGenerator(generatorId, locale)
		),
	});
	const character = createCharacterFixture();
	populateRandomCharacter(character, {
		background: `${backgroundRoute.id}:${archetype.id}`,
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
	for (const item of [...character.gear.equipment, ...character.gear.inventory]) {
		assert.match(item, / — Common — Made of [^—]+ — Runed — /);
	}
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
	return new Character('Test');
}

function createReferenceResolutionOptions(locale) {
	const route = generatorCatalog.getGenerator('background', locale).entries[0];
	const backgroundGenerator = structuredClone(
		generatorCatalog.getGenerator(route.generator, locale),
	);
	const archetype = backgroundGenerator.entries[0];
	archetype.generation = {
		modifiers: [],
		fixedRules: [],
		armor: 'armors:padded_armor',
		equipment: [],
		inventory: [],
	};
	const getGenerator = (generatorId, requestedLocale) => (
		generatorId === backgroundGenerator.id
			? backgroundGenerator
			: generatorCatalog.getGenerator(generatorId, requestedLocale)
	);
	const baseResolver = generatorResolver.createGeneratorResolver({ getGenerator });
	const resolvedReferences = [];
	const resolver = {
		...baseResolver,
		resolveReference(reference, requestedLocale, options) {
			resolvedReferences.push(reference);
			return baseResolver.resolveReference(reference, requestedLocale, options);
		},
	};
	return {
		options: {
			background: `${route.id}:${archetype.id}`,
			getGenerator,
			getStatProfile: () => createFixedLevelOneStatProfile(),
			level: 1,
			locale,
			resolver,
		},
		resolvedReferences,
	};
}

function createFixedLevelOneStatProfile() {
	const values = {
		constitution: 10,
		strength: 10,
		dexterity: 10,
		intelligence: 10,
		speed: 9,
		perception: 9,
		charisma: 9,
	};
	return {
		id: DEFAULT_STAT_PROFILE_ID,
		minimums: { ...values },
		maximums: { ...values },
		weights: Object.fromEntries(BASE_STATS.map(stat => [stat, 1])),
	};
}

function getWeightedEntryMidpoint(generatorId, entryId, locale) {
	const entries = generatorCatalog.getGenerator(generatorId, locale).entries;
	const totalWeight = entries.reduce(
		(total, entry) => total + (entry.weight ?? 1),
		0,
	);
	let previousWeight = 0;
	for (const entry of entries) {
		const weight = entry.weight ?? 1;
		if (entry.id === entryId) {
			return (previousWeight + weight / 2) / totalWeight;
		}
		previousWeight += weight;
	}
	throw new Error(`Unknown ${generatorId} entry ${entryId}.`);
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

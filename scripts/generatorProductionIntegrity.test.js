const assert = require('node:assert/strict');
const { test } = require('node:test');
const generatorCatalog = require('../services/generatorCatalog');
const generatorResolver = require('../services/generatorResolver');
const {
	isGeneratorRouter,
	validateRoutedArchetypeStatProfileRelationships,
} = require('../services/generatorSchema');
const {
	createStatProfileCandidate,
} = require('../services/statProfileCatalog');

test('production routed background and creature generators use the consolidated schema path', () => {
	const catalogs = generatorCatalog.createGeneratorCatalogCandidate();
	assert.equal(
		validateRoutedArchetypeStatProfileRelationships(
			catalogs,
			createStatProfileCandidate(),
		),
		true,
	);
	for (const [routerId, requiredFields, forbiddenTemplateProperty] of [
		['background', [], 'traits'],
		['creature', ['description'], 'talents'],
	]) {
		for (const locale of ['en', 'fr']) {
			const router = catalogs.get(locale).get(routerId);
			for (const route of router.entries) {
				const child = catalogs.get(locale).get(route.generator);
				assert.equal(child.visibility, 'internal');
				assert.deepEqual(child.entrySchema.required, requiredFields);
				assert.ok(child.entries.every(entry => (
					entry.generation === undefined
					|| !Object.hasOwn(entry.generation, forbiddenTemplateProperty)
				)));
			}
		}
	}
});

test('complete production catalogs validate in both locales under schema v4', () => {
	const catalogs = generatorCatalog.createGeneratorCatalogCandidate();
	assert.equal(catalogs.get('en').size, catalogs.get('fr').size);
	assert.ok(catalogs.get('en').size > 0);
	const all = generatorCatalog.listGenerators('en', { visibility: 'all' });
	for (const modifier of all.filter(generator => (
		['modifier_character', 'modifier_creature'].includes(generator.id)
			|| generator.id.startsWith('site_modifier_')
	))) {
		assert.equal(modifier.visibility, 'internal');
		assert.equal(isGeneratorRouter(modifier), false);
		assert.ok(modifier.entries.every(entry => (
			Object.keys(entry).every(key => ['id', 'name', 'weight', 'fields'].includes(key))
		)));
	}
	for (const locale of ['en', 'fr']) {
		const quest = generatorCatalog.getGenerator('quest', locale);
		assert.deepEqual(quest.entrySchema.required, ['description']);
		assert.ok(quest.entries.every(entry => entry.fields.description.includes('{{')));
	}
});

test('every production quest, rumor, and secret resolves references with provenance', () => {
	for (const locale of ['en', 'fr']) {
		for (const generatorId of ['quest', 'rumor', 'secret']) {
			const entries = generatorCatalog.getGenerator(generatorId, locale).entries;
			for (const entry of entries) {
				const result = generatorResolver.resolveReference(
					{ generator: generatorId, entry: entry.id, select: 'display' },
					locale,
					{ random: () => 0 },
				);
				assert.ok(result);
				assert.ok(result.value || Object.keys(result.displayFields ?? {}).length > 0);
				assert.doesNotMatch(result.value, /\{\{|\}\}|undefined/);
				assert.ok(result.provenance.length > 1, `${locale}:${entry.id}`);
				assert.equal(result.provenance[0].generatorId, generatorId);
				assert.equal(result.provenance[0].entryId, entry.id);
			}
		}
	}
});

test('production category routers are minimal and traverse internal child generators', () => {
	const routers = new Map([
		['background', [
			'criminal',
			'adventurer',
			'noble',
			'peasant',
			'artisan',
			'merchant',
			'scholar',
			'religious',
			'military',
			'outlander',
			'sailor',
			'performer',
			'servant',
			'official',
			'mage',
			'exile',
			'urchin',
		]],
		['creature', ['animal', 'companion', 'monster']],
		['loot', [
			'weapons',
			'shields',
			'armors',
			'supplies',
			'consumable',
			'food_and_drink',
			'valuables',
			'material',
			'curio',
		]],
		['site', ['building', 'dungeon', 'settlement', 'region', 'room']],
		['group', ['government', 'faction', 'religion']],
		['modifier', [
			'modifier_character',
			'modifier_creature',
			'modifier_rarity',
			'modifier_material',
			'modifier_loot',
			'modifier_site_all',
			'modifier_site_building',
			'modifier_site_interiors',
			'modifier_site_structures',
		]],
	]);
	for (const locale of ['en', 'fr']) {
		for (const [routerId, childIds] of routers) {
			const router = generatorCatalog.getGenerator(routerId, locale);
			assert.equal(router.visibility, 'public');
			assert.equal(isGeneratorRouter(router), true);
			assert.deepEqual(router.entrySchema.required, []);
			assert.ok(router.entries.every(entry => (
				Object.keys(entry).every(key => (
					['id', 'name', 'weight', 'generator'].includes(key)
				))
			)));
			assert.deepEqual(router.entries.map(entry => entry.generator), childIds);
			for (const route of router.entries) {
				const childId = route.generator;
				assert.equal(generatorCatalog.getGenerator(childId, locale).visibility, 'internal');
				const result = generatorResolver.generate(
					`${routerId}:${route.id}`,
					locale,
					{ random: () => 0.5 },
				);
				assert.ok(result);
				assert.ok(result.value || Object.keys(result.displayFields ?? {}).length > 0);
				assert.deepEqual(
					result.provenance.slice(0, 2).map(record => record.generatorId),
					[routerId, childId],
				);
				const explicitResult = generatorResolver.generate(
					`${routerId}:${route.id}.generator`,
					locale,
					{ random: () => 0.5 },
				);
				assert.equal(explicitResult.generatorId, result.generatorId);
				assert.equal(explicitResult.entryId, result.entryId);
			}
		}
	}
});

test('creature catalogs include generic archetypes and intentional statistical profiles', () => {
	const animalProfiles = createExpectedProfileMap({
		'creature-animal-runner': [
			'mossback_deer',
			'river_otter',
			'long_eared_hare',
			'bluehorn_goat',
			'reed_crane',
			'whistle_marmot',
			'mist_dolphin',
			'scavenger_rat',
			'weaver_spider',
			'thieving_monkey',
			'cave_bat',
			'horse',
		],
		'creature-animal-tank': [
			'burrow_pig',
			'sailback_turtle',
			'silk_alpaca',
			'pebble_crab',
			'glimmer_whale',
			'armored_crab',
			'burrowing_armadillo',
			'cattle_cow',
			'badger',
			'beaver',
		],
		'creature-animal-magic': [
			'lantern_finch',
			'cloud_sheep',
			'ember_newt',
			'rain_frog',
			'moon_moth',
			'orchard_drake',
			'star_elk',
			'memory_crow',
			'solar_lizard',
		],
		'creature-predator': [
			'copper_fox',
			'reed_snake',
			'hill_wolf',
			'eagle',
			'owl',
			'crocodile',
			'shark',
		],
		'creature-brute': [
			'honey_bear',
			'ox',
			'wild_boar',
			'brown_bear',
			'moose',
		],
	});
	const companionProfiles = createExpectedProfileMap({
		'creature-companion': [
			'loyal_hound',
			'barn_cat',
			'messenger_pigeon',
			'clever_rat',
			'pocket_ferret',
			'mule',
			'moss_tortoise',
			'whisper_crow',
			'breeze_lizard',
			'cave_bat',
			'river_otter',
			'messenger_raptor',
			'riding_horse',
			'pony',
			'donkey',
			'camel',
			'owl',
			'raven',
			'parrot',
			'toad_frog',
		],
		'creature-companion-magic': [
			'pack_goat',
			'watch_goose',
			'lantern_finch',
			'ember_newt',
			'miniature_slime',
			'clockwork_beetle',
			'tiny_griffin',
			'blink_rabbit',
			'paper_dragon',
			'ghost_mouse',
			'cloud_pup',
			'moon_moth',
			'sir_candlewick',
		],
		'creature-elemental': ['pebble_elemental'],
	});
	const genericMonsterProfiles = createExpectedProfileMap({
		'creature-predator': [
			'kobold',
			'gnoll',
			'ghoul',
			'giant_rat',
			'giant_spider',
			'giant_snake',
			'dire_wolf',
			'cockatrice',
			'manticore',
			'wyvern',
			'hell_hound',
		],
		'creature-brute': [
			'zombie',
			'giant_scorpion',
			'mimic',
			'gelatinous_cube',
			'ettin',
			'shambling_mound',
		],
		'creature-caster': ['lich'],
	});

	for (const locale of ['en', 'fr']) {
		const animal = generatorCatalog.getGenerator('animal', locale);
		assert.equal(
			animal.description,
			locale === 'en'
				? 'Ordinary and fantastical wildlife'
				: 'Faune ordinaire et fantastique',
		);
		assertExactCreatureProfiles(animal, animalProfiles);
		assertHigherCreatureWeights(
			animal,
			['horse', 'cattle_cow', 'long_eared_hare', 'cave_bat'],
			['lantern_finch', 'cloud_sheep', 'moon_moth', 'star_elk'],
		);

		const companion = generatorCatalog.getGenerator('companion', locale);
		assertExactCreatureProfiles(companion, companionProfiles);
		assertHigherCreatureWeights(
			companion,
			['barn_cat', 'riding_horse', 'pony', 'donkey'],
			['pack_goat', 'lantern_finch', 'blink_rabbit', 'paper_dragon'],
		);

		const monster = generatorCatalog.getGenerator('monster', locale);
		const monstersById = new Map(monster.entries.map(entry => [entry.id, entry]));
		for (const [entryId, profileId] of genericMonsterProfiles) {
			const entry = monstersById.get(entryId);
			assert.ok(entry, `${locale}:monster:${entryId}`);
			assert.ok(entry.name, `${locale}:monster:${entryId}:name`);
			assert.ok(entry.fields.description, `${locale}:monster:${entryId}:description`);
			assert.equal(
				entry.generation.statProfile,
				profileId,
				`${locale}:monster:${entryId}:profile`,
			);
		}
		assertHigherCreatureWeights(
			monster,
			['kobold', 'zombie', 'giant_rat'],
			['grave_hound', 'cinder_drake', 'lich'],
		);
		assert.equal(monstersById.has('goblin'), false);
	}
});

test('loot replaces every inventory entry across heterogeneous additional fields', () => {
	assert.equal(generatorCatalog.getGenerator('inventory'), undefined);
	for (const [generatorId, expectedCount, requiredFields] of [
		['weapons', 52, ['description']],
		['shields', 14, ['description']],
		['armors', 16, ['type', 'description']],
		['supplies', 38, ['description']],
		['consumable', 26, ['description']],
		['food_and_drink', 26, ['description']],
		['valuables', 25, ['description']],
		['material', 46, ['description']],
		['curio', 24, ['description']],
	]) {
		const generator = generatorCatalog.getGenerator(generatorId);
		assert.equal(generator.entries.length, expectedCount, generatorId);
		assert.deepEqual(generator.entrySchema.required, requiredFields, generatorId);
	}
});

test('loot identities use the configured independent modifier families and weights', () => {
	const equipmentModifiers = {
		modifier_rarity: 100,
		modifier_material: 15,
		modifier_loot: 10,
	};
	for (const generatorId of ['weapons', 'shields', 'armors']) {
		assert.deepEqual(
			generatorCatalog.getGenerator(generatorId, 'en').modifiers,
			equipmentModifiers,
		);
	}
	for (const [generatorId, percentage] of [
		['supplies', 10],
		['consumable', 10],
		['food_and_drink', 5],
		['valuables', 10],
		['curio', 10],
	]) {
		assert.deepEqual(generatorCatalog.getGenerator(generatorId, 'en').modifiers, {
			modifier_loot: percentage,
		});
	}
	assert.equal(generatorCatalog.getGenerator('material', 'en').modifiers, undefined);
	for (const locale of ['en', 'fr']) {
		for (const generatorId of ['weapons', 'shields', 'supplies', 'curio']) {
			assert.ok(generatorCatalog.getGenerator(generatorId, locale).entries.every(entry => (
				!entry.id.startsWith('runed_')
			)));
		}
	}
	const weaponIds = new Set(generatorCatalog.getGenerator('weapons', 'en').entries
		.map(entry => entry.id));
	assert.ok(['maul', 'chakram', 'longbow'].every(id => weaponIds.has(id)));
	assert.ok([
		'meteor_iron_maul',
		'moon_silver_chakram',
		'bone_longbow',
	].every(id => !weaponIds.has(id)));

	const rarity = generatorCatalog.getGenerator('modifier_rarity', 'en');
	assert.deepEqual(
		rarity.entries.map(entry => [entry.id, entry.weight]),
		[
			['common', 8],
			['uncommon', 5],
			['rare', 3],
			['epic', 2],
			['legendary', 1],
		],
	);
	const material = generatorCatalog.getGenerator('modifier_material', 'en');
	assert.equal(material.entries.length, 1);
	assert.match(material.entries[0].name, /\{\{ material\.name \}\}/);

	const loot = generatorCatalog.getGenerator('modifier_loot', 'en');
	assert.deepEqual(
		loot.entries.map(entry => [entry.id, entry.name, entry.weight]),
		[
			['runed', 'Runed', 6],
			['damaged', 'Damaged', 6],
			['ancient', 'Ancient', 6],
			['cursed_affliction', 'Cursed', 3],
			['cursed_status_effect', 'Cursed', 3],
			['possessed_animal', 'Possessed', 2],
			['possessed_companion', 'Possessed', 2],
			['possessed_monster', 'Possessed', 2],
			['faction_made', 'Faction-made', 6],
		],
	);
	const referencesByEntry = new Map([
		['runed', '{{ rules.name }}'],
		['cursed_affliction', '{{ affliction.name }}'],
		['cursed_status_effect', '{{ status_effect.name }}'],
		['possessed_animal', '{{ animal.name }}'],
		['possessed_companion', '{{ companion.name }}'],
		['possessed_monster', '{{ monster.name }}'],
		['faction_made', '{{ faction.name }}'],
	]);
	for (const [entryId, reference] of referencesByEntry) {
		assert.ok(loot.entries.find(entry => entry.id === entryId)
			.fields.description.includes(reference));
	}
	const conceptWeights = loot.entries.reduce((totals, entry) => {
		const concept = entry.id.startsWith('cursed_')
			? 'cursed'
			: entry.id.startsWith('possessed_') ? 'possessed' : entry.id;
		totals[concept] = (totals[concept] ?? 0) + entry.weight;
		return totals;
	}, {});
	assert.deepEqual(conceptWeights, {
		runed: 6,
		damaged: 6,
		ancient: 6,
		cursed: 6,
		possessed: 6,
		faction_made: 6,
	});
});

test('direct loot generation keeps modifiers separate from the base result', () => {
	const result = generatorResolver.generate(
		'loot:weapons:short_sword',
		'en',
		{ random: () => 0 },
	);
	assert.deepEqual(Object.keys(result.displayFields), ['name', 'description']);
	assert.doesNotMatch(Object.values(result.displayFields).join(' '), /Common|Made of|Runed/);
	assert.deepEqual(result.modifiers.map(modifier => modifier.generatorId), [
		'modifier_rarity',
		'modifier_material',
		'modifier_loot',
	]);
	assert.deepEqual(
		generatorResolver.generate(
			'loot:weapons:short_sword.description',
			'en',
			{ random: () => 0 },
		).modifiers,
		[],
	);
	assert.equal(
		generatorResolver.generate('loot:supplies:coil_of_rope', 'en', {
			random: () => 0.099999,
		}).modifiers.length,
		1,
	);
	assert.equal(
		generatorResolver.generate('loot:supplies:coil_of_rope', 'en', {
			random: () => 0.1,
		}).modifiers.length,
		0,
	);
	assert.equal(
		generatorResolver.generate('loot:food_and_drink:three_travel_rations', 'en', {
			random: () => 0.049999,
		}).modifiers.length,
		1,
	);
	assert.equal(
		generatorResolver.generate('loot:food_and_drink:three_travel_rations', 'en', {
			random: () => 0.05,
		}).modifiers.length,
		0,
	);
});

test('armor and shield forms keep identity separate from mechanical rarity', () => {
	const armors = generatorCatalog.getGenerator('armors', 'en');
	assert.deepEqual(armors.entrySchema.required, ['type', 'description']);
	assert.deepEqual(
		Object.fromEntries(['light', 'medium', 'heavy'].map(type => [
			type,
			armors.entries.filter(entry => entry.fields.type === type).length,
		])),
		{ light: 5, medium: 6, heavy: 5 },
	);
	const shields = generatorCatalog.getGenerator('shields', 'en');
	assert.deepEqual(shields.entrySchema.required, ['description']);
	assert.deepEqual(new Set(shields.entries.map(entry => entry.id)), new Set([
		'buckler',
		'round_shield',
		'kite_shield',
		'heater_shield',
		'targe',
		'tower_shield',
		'pavise',
		'dueling_shield',
		'folding_shield',
		'mirrored_shield',
		'guardian_shield',
		'stormward_shield',
		'eclipse_shield',
		'oathkeeper_shield',
	]));
	for (const locale of ['en', 'fr']) {
		assert.ok(generatorCatalog.getGenerator('armors', locale).entries.every(entry => (
			['light', 'medium', 'heavy'].includes(entry.fields.type)
			&& !Object.hasOwn(entry.fields, 'rarity')
			&& !Object.hasOwn(entry.fields, 'constitution_requirement')
			&& !Object.hasOwn(entry.fields, 'ar_percentage')
		)));
		assert.ok(generatorCatalog.getGenerator('shields', locale).entries.every(entry => (
			!Object.hasOwn(entry.fields, 'rarity')
			&& !Object.hasOwn(entry.fields, 'ar_percentage')
		)));
	}
});

test('ability is an open-ended public name-only vocabulary', () => {
	const expectedIds = [
		'constitution',
		'strength',
		'dexterity',
		'intelligence',
		'speed',
		'perception',
		'charisma',
		'acrobatics',
		'animal_handling',
		'arcana',
		'athletics',
		'deception',
		'history',
		'insight',
		'intimidation',
		'investigation',
		'medicine',
		'nature',
		'performance',
		'persuasion',
		'religion',
		'sleight_of_hand',
		'stealth',
		'survival',
		'lockpicking',
		'tracking',
		'navigation',
		'crafting',
		'leadership',
	];
	const expectedEnglishNames = [
		'Constitution',
		'Strength',
		'Dexterity',
		'Intelligence',
		'Speed',
		'Perception',
		'Charisma',
		'Acrobatics',
		'Animal Handling',
		'Arcana',
		'Athletics',
		'Deception',
		'History',
		'Insight',
		'Intimidation',
		'Investigation',
		'Medicine',
		'Nature',
		'Performance',
		'Persuasion',
		'Religion',
		'Sleight of Hand',
		'Stealth',
		'Survival',
		'Lockpicking',
		'Tracking',
		'Navigation',
		'Crafting',
		'Leadership',
	];
	for (const locale of ['en', 'fr']) {
		const ability = generatorCatalog.getGenerator('ability', locale);
		assert.equal(ability.visibility, 'public');
		assert.deepEqual(ability.entrySchema.required, []);
		assert.deepEqual(ability.entries.map(entry => entry.id), expectedIds);
		assert.ok(ability.entries.every(entry => (
			Object.keys(entry).length === 2
			&& typeof entry.name === 'string'
			&& entry.name.length > 0
		)));
	}
	const english = generatorCatalog.getGenerator('ability', 'en');
	assert.deepEqual(english.entries.map(entry => entry.name), expectedEnglishNames);
	assert.equal(english.entries.filter(entry => entry.id === 'perception').length, 1);
});

test('expanded consumables reuse ability and affliction without fixed numerical effects', () => {
	const consumable = generatorCatalog.getGenerator('consumable', 'en');
	const entries = new Map(consumable.entries.map(entry => [entry.id, entry]));
	assert.equal(entries.get('healing_potion').weight, 4);
	for (const entryId of [
		'strong_healing_potion',
		'holy_water',
		'incendiary_flask',
		'potion_of_fire_resistance',
		'potion_of_cold_resistance',
		'potion_of_invisibility',
		'potion_of_ability',
		'affliction_remedy',
	]) {
		assert.ok(entries.has(entryId), entryId);
	}
	assert.equal(entries.has('potion_of_climbing'), false);
	assert.equal(entries.has('potion_of_speed'), false);
	assert.match(entries.get('potion_of_ability').name, /\{\{ ability\.name \}\}/);
	assert.match(
		entries.get('potion_of_ability').fields.description,
		/exact magnitude and duration remain with the GM/,
	);
	assert.match(entries.get('affliction_remedy').name, /\{\{ affliction\.name \}\}/);
	assert.match(
		entries.get('affliction_remedy').fields.description,
		/medicine, antidote, ritual preparation, or other treatment/,
	);

	for (const locale of ['en', 'fr']) {
		for (const entryId of ['potion_of_ability', 'affliction_remedy']) {
			const result = generatorResolver.generate(
				`loot:consumable:${entryId}`,
				locale,
				{ random: () => 0 },
			);
			assert.doesNotMatch(Object.values(result.displayFields).join(' '), /\{\{|\}\}/);
		}
	}
});

test('expanded loot catalogs cover useful basics, reusable references, and fun outliers', () => {
	const idsFor = generatorId => new Set(
		generatorCatalog.getGenerator(generatorId, 'en').entries.map(entry => entry.id),
	);
	const requireIds = (generatorId, requiredIds) => {
		const ids = idsFor(generatorId);
		for (const entryId of requiredIds) {
			assert.ok(ids.has(entryId), `${generatorId}:${entryId}`);
		}
	};

	requireIds('weapons', [
		'pike', 'sickle', 'hand_crossbow', 'darts', 'net', 'chakram', 'maul',
	]);
	requireIds('supplies', [
		'backpack',
		'torches',
		'compass',
		'chain',
		'cloak',
		'boots',
		'cooking_kit',
		'sewing_repair_kit',
		'whetstone',
		'empty_bottles_and_vials',
	]);
	requireIds('valuables', [
		'gold_ingot',
		'silver_ingot',
		'signet_ring',
		'fine_ring',
		'necklace',
		'bracelet',
		'amulet',
		'pearl_necklace',
		'rare_spices',
		'perfume',
	]);
	requireIds('material', [
		'glass',
		'clay',
		'wool',
		'silk',
		'bone',
		'salt',
		'coal',
		'sulfur',
		'monster_hide',
		'dragon_scales',
		'dirt',
	]);
	for (const forbiddenId of ['tin', 'lead', 'brass', 'linen', 'ivory', 'chitin']) {
		assert.equal(idsFor('material').has(forbiddenId), false, forbiddenId);
	}
	const materials = new Map(generatorCatalog.getGenerator('material', 'en').entries
		.map(entry => [entry.id, entry]));
	assert.equal(materials.get('dirt').weight, 1);
	assert.ok(materials.get('dirt').weight < materials.get('glass').weight);

	requireIds('curio', [
		'strange_coin',
		'mechanical_music_box',
		'miniature_portrait',
		'unusual_deck_of_cards',
		'petrified_eye',
		'impossible_weather_bottle',
		'nonexistent_settlement_map',
		'broken_magical_focus',
	]);
	const supplies = new Map(generatorCatalog.getGenerator('supplies', 'en').entries
		.map(entry => [entry.id, entry]));
	assert.match(supplies.get('holy_symbol').fields.description, /\{\{ religion\.sacred_symbol \}\}/);
	assert.match(supplies.get('local_map').fields.description, /\{\{ region\.name \}\}/);
	const curios = new Map(generatorCatalog.getGenerator('curio', 'en').entries
		.map(entry => [entry.id, entry]));
	assert.match(curios.get('treasure_map').fields.description, /\{\{ dungeon\.name \}\}/);

	const food = new Map(generatorCatalog.getGenerator('food_and_drink', 'en').entries
		.map(entry => [entry.id, entry]));
	for (const entryId of [
		'fresh_bread',
		'cheese_wheel',
		'dried_meat',
		'smoked_fish',
		'fresh_fruit',
		'preserved_fruit',
		'vegetables',
		'three_travel_rations',
		'roasted_chicken',
		'roasted_meat',
		'soup',
		'stew',
		'porridge',
		'eggs',
		'ale',
		'beer',
		'mead',
		'cider',
		'wine',
		'spirits',
		'water',
		'herbal_tea',
	]) {
		assert.ok(food.has(entryId), entryId);
	}
	for (const removedId of [
		'honey_cakes',
		'spiced_nuts',
		'pepper_root_stew',
		'fermented_milk',
		'strong_herbal_tonic',
	]) {
		assert.equal(food.has(removedId), false, removedId);
	}
	const lowestStapleWeight = Math.min(...[
		'fresh_bread',
		'cheese_wheel',
		'dried_meat',
		'fresh_fruit',
		'vegetables',
		'soup',
		'stew',
		'porridge',
		'eggs',
		'water',
	].map(entryId => food.get(entryId).weight));
	const highestUnusualWeight = Math.max(...[
		'exotic_fruit',
		'regional_delicacy',
		'mushroom_broth',
	].map(entryId => food.get(entryId).weight));
	assert.ok(lowestStapleWeight > highestUnusualWeight);
});

test('affliction fields are localized while their classifications remain data', () => {
	const affliction = generatorCatalog.getGenerator('affliction', 'en');
	assert.deepEqual(affliction.entrySchema, {
		required: ['type', 'description'],
	});
	assert.equal(affliction.entries.filter(entry => entry.fields.type === 'disease').length, 8);
	assert.equal(affliction.entries.filter(entry => entry.fields.type === 'curse').length, 8);
	const frenchAffliction = generatorCatalog.getGenerator('affliction', 'fr');
	assert.equal(new Set(frenchAffliction.entries.map(entry => entry.fields.type)).size, 2);
	assert.ok(frenchAffliction.entries.every(entry => (
		!['disease', 'curse'].includes(entry.fields.type)
	)));
});

test('affliction symptom references resolve as grammatical localized status labels', () => {
	const expectations = {
		en: {
			ash_fever: 'A smoky fever causes the Feverish status effect and sensitivity to open flame.',
			spore_fever: 'An invasive fungus causes vivid dreams and the Confused status effect.',
		},
		fr: {
			ash_fever: 'Une fièvre chargée de cendres inflige l’état Fiévreux et rend le malade sensible aux flammes nues.',
			spore_fever: 'Une infection fongique provoque des rêves intenses et inflige l’état Confus.',
		},
	};
	for (const [locale, entries] of Object.entries(expectations)) {
		for (const [entry, expected] of Object.entries(entries)) {
			const result = generatorResolver.resolveReference(
				{ generator: 'affliction', entry, select: 'fields.description' },
				locale,
				{ random: () => 0 },
			);
			assert.equal(result.value, expected);
			assert.deepEqual(
				result.provenance.map(record => [record.generatorId, record.entryId]),
				[
					['affliction', entry],
					['status_effect', entry === 'ash_fever' ? 'feverish' : 'confused'],
				],
			);
		}
	}
});

test('migrated creature and quest references target classified loot concepts', () => {
	for (const locale of ['en', 'fr']) {
		const companion = generatorCatalog.getGenerator('companion', locale);
		const references = Object.fromEntries(companion.entries.map(entry => [
			entry.id,
			entry.generation.inventory,
		]));
		assert.deepEqual(references.messenger_pigeon, [{
			generator: 'curio',
			entry: 'mysterious_sealed_letter',
			select: 'fields',
		}]);
		assert.deepEqual(references.pack_goat, [{
			generator: 'food_and_drink',
			entry: 'three_travel_rations',
			select: 'fields',
		}]);
		assert.deepEqual(references.mule, [{
			generator: {
				oneOf: [
					{ id: 'supplies', weight: 3 },
					{ id: 'weapons', weight: 1 },
				],
			},
			select: 'fields',
		}]);
		assert.deepEqual(references.paper_dragon, [{
			generator: 'supplies',
			entry: 'writing_kit',
			select: 'fields',
		}]);

		const questValues = Object.fromEntries(
			generatorCatalog.getGenerator('quest', locale).entries
				.map(entry => [entry.id, entry.fields.description]),
		);
		assert.match(questValues.recover_item_before_criminal, /\{\{ curio \}\}/);
		assert.match(questValues.hide_item_from_faction, /\{\{ curio \}\}/);
		for (const id of [
			'steal_item_from_building',
			'anonymous_gift',
			'deliver_contested_goods',
		]) {
			assert.match(questValues[id], /\{\{ valuables \}\}/);
		}
		assert.equal(Object.values(questValues).some(value => (
			value.includes('{{ inventory }}') || value.includes('{{ creature_monster }}')
		)), false);
	}
});

test('production catalogs preserve deterministic IDs across locales', () => {
	for (const english of generatorCatalog.listGenerators('en')) {
		for (const randomValue of [0, 0.37, 0.999999]) {
			const en = generatorResolver.generate(english.id, 'en', {
				random: () => randomValue,
			});
			const fr = generatorResolver.generate(english.id, 'fr', {
				random: () => randomValue,
			});
			assert.equal(en.entryId, fr.entryId, `${english.id}:${randomValue}`);
			assert.deepEqual(
				en.provenance.map(record => [record.generatorId, record.entryId]),
				fr.provenance.map(record => [record.generatorId, record.entryId]),
				`${english.id}:${randomValue}`,
			);
			assert.deepEqual(
				en.modifiers.map(modifier => modifier.entryId),
				fr.modifiers.map(modifier => modifier.entryId),
				`${english.id}:${randomValue}`,
			);
		}
	}
});

function createExpectedProfileMap(groups) {
	return new Map(Object.entries(groups).flatMap(([profileId, entryIds]) => (
		entryIds.map(entryId => [entryId, profileId])
	)));
}

function assertExactCreatureProfiles(generator, expectedProfiles) {
	assert.equal(generator.entries.length, expectedProfiles.size, generator.id);
	for (const entry of generator.entries) {
		assert.equal(
			entry.generation.statProfile,
			expectedProfiles.get(entry.id),
			`${generator.locale}:${generator.id}:${entry.id}`,
		);
	}
}

function assertHigherCreatureWeights(generator, basicEntryIds, exceptionalEntryIds) {
	const weights = new Map(generator.entries.map(entry => [entry.id, entry.weight]));
	const basicWeights = basicEntryIds.map(entryId => weights.get(entryId));
	const exceptionalWeights = exceptionalEntryIds.map(entryId => weights.get(entryId));
	assert.ok(basicWeights.every(Number.isFinite), `${generator.id}:basic weights`);
	assert.ok(exceptionalWeights.every(Number.isFinite), `${generator.id}:exceptional weights`);
	assert.ok(
		Math.min(...basicWeights) > Math.max(...exceptionalWeights),
		`${generator.id}: basic creatures should be more common`,
	);
}

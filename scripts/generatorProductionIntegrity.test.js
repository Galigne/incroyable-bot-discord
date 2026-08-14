const assert = require('node:assert/strict');
const { test } = require('node:test');
const generatorCatalog = require('../services/generatorCatalog');
const generatorResolver = require('../services/generatorResolver');

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

test('production category routers traverse equal-weight internal child generators', () => {
	const routers = new Map([
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
	]);
	for (const locale of ['en', 'fr']) {
		for (const [routerId, childIds] of routers) {
			const router = generatorCatalog.getGenerator(routerId, locale);
			assert.equal(router.visibility, 'public');
			assert.deepEqual(router.entries.map(entry => entry.id), childIds);
			for (const childId of childIds) {
				assert.equal(generatorCatalog.getGenerator(childId, locale).visibility, 'internal');
				const result = generatorResolver.generate(
					`${routerId}:${childId}.generator`,
					locale,
					{ random: () => 0.5 },
				);
				assert.ok(result);
				assert.ok(result.value || Object.keys(result.displayFields ?? {}).length > 0);
				assert.deepEqual(
					result.provenance.slice(0, 2).map(record => record.generatorId),
					[routerId, childId],
				);
			}
		}
	}
});

test('loot replaces every inventory entry across heterogeneous additional fields', () => {
	assert.equal(generatorCatalog.getGenerator('inventory'), undefined);
	for (const [generatorId, expectedCount, requiredFields] of [
		['weapons', 53, ['description']],
		['shields', 16, ['rarity', 'description', 'ar_percentage']],
		['armors', 15, ['type', 'rarity', 'description', 'constitution_requirement', 'ar_percentage']],
		['supplies', 32, ['description']],
		['consumable', 18, ['description']],
		['food_and_drink', 18, ['description']],
		['valuables', 15, ['description']],
		['material', 35, ['description']],
		['curio', 22, ['description']],
	]) {
		const generator = generatorCatalog.getGenerator(generatorId);
		assert.equal(generator.entries.length, expectedCount, generatorId);
		assert.deepEqual(generator.entrySchema.required, requiredFields, generatorId);
	}
});

test('shield and affliction fields are public, localized, and mechanically stable', () => {
	const shieldExpectations = new Map([
		['common', { ar: 5, weights: [8, 8, 8] }],
		['uncommon', { ar: 10, weights: [5, 5, 5] }],
		['rare', { ar: 15, weights: [3, 3, 3, 1] }],
		['epic', { ar: 20, weights: [2, 2, 2] }],
		['legendary', { ar: 25, weights: [1, 1, 1] }],
	]);
	const shields = generatorCatalog.getGenerator('shields', 'en');
	assert.deepEqual(shields.entrySchema, {
		required: ['rarity', 'description', 'ar_percentage'],
	});
	for (const [rarity, expected] of shieldExpectations) {
		const entries = shields.entries.filter(entry => entry.fields.rarity === rarity);
		assert.deepEqual(entries.map(entry => entry.weight), expected.weights);
		assert.ok(entries.every(entry => entry.fields.ar_percentage === expected.ar));
	}
	const frenchShields = generatorCatalog.getGenerator('shields', 'fr');
	assert.deepEqual(
		frenchShields.entries.map(entry => entry.fields.ar_percentage),
		shields.entries.map(entry => entry.fields.ar_percentage),
	);
	assert.notEqual(frenchShields.entries[0].fields.rarity, shields.entries[0].fields.rarity);

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

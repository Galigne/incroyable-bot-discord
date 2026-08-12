const assert = require('node:assert/strict');
const { test } = require('node:test');
const generatorCatalog = require('../services/generatorCatalog');
const generatorResolver = require('../services/generatorResolver');

test('production catalogs exclude retired roots and obsolete mechanical payloads', () => {
	assert.equal(generatorCatalog.getGenerator('npc'), undefined);
	assert.equal(generatorCatalog.getGenerator('criminal'), undefined);
	assert.equal(
		generatorCatalog.getGenerator('background_criminal').visibility,
		'internal',
	);
	const all = generatorCatalog.listGenerators('en', { visibility: 'all' });
	const serialized = JSON.stringify(all);
	assert.doesNotMatch(serialized, /"generator":"(?:npc|criminal)"/);
	assert.doesNotMatch(serialized, /"Encumbrance"/i);
	assert.doesNotMatch(serialized, /challengeRating|fixedStatistics|statOverrides/);
	for (const modifier of all.filter(generator => (
		['modifier_character', 'modifier_creature'].includes(generator.id)
			|| generator.id.startsWith('site_modifier_')
	))) {
		assert.equal(modifier.visibility, 'internal');
		assert.ok(modifier.entries.every(entry => (
			Object.keys(entry).every(key => ['id', 'weight', 'fields'].includes(key))
		)));
	}
	for (const locale of ['en', 'fr']) {
		const quest = generatorCatalog.getGenerator('quest', locale);
		assert.equal(Object.hasOwn(quest, 'kind'), false);
		assert.equal(quest.entrySchema.type, 'text');
		assert.ok(quest.entries.every(entry => (
			!Object.hasOwn(entry, 'template')
			&& !Object.hasOwn(entry, 'references')
			&& entry.value.includes('{{')
		)));
	}
});

test('every production quest resolves role-oriented references with provenance', () => {
	for (const locale of ['en', 'fr']) {
		const quests = generatorCatalog.getGenerator('quest', locale).entries;
		for (const quest of quests) {
			const result = generatorResolver.resolveReference(
				{ generator: 'quest', entry: quest.id, select: 'display' },
				locale,
				{ random: () => 0 },
			);
			assert.ok(result.value);
			assert.doesNotMatch(result.value, /\{\{|\}\}|undefined/);
			assert.ok(result.provenance.length > 1, `${locale}:${quest.id}`);
			assert.equal(result.provenance[0].generatorId, 'quest');
			assert.equal(result.provenance[0].entryId, quest.id);
		}
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

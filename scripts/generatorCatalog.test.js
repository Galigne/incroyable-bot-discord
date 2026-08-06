const assert = require('node:assert/strict');
const fsPromises = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const {
	AUTOCOMPLETE_PROVIDERS,
} = require('../commands/autocompleteProviders');
const generatorCatalog = require('../services/generatorCatalog');
const generatorResolver = require('../services/generatorResolver');
const {
	validateGeneratorDefinition,
	validateGeneratorPair,
} = require('../services/generatorSchema');
const { BASE_STATS } = require('../services/mechanics/constants');
const statProfileCatalog = require('../services/statProfileCatalog');
const {
	getEntryWeight,
	selectWeightedEntry,
} = require('../services/weightedSelector');
const { getCommandOptionValues } = require('../util/commandOptionValues');

test('production generator v2 data uses stable IDs, strict parity, and visibility', () => {
	const englishPublic = generatorCatalog.listGenerators('en');
	const frenchPublic = generatorCatalog.listGenerators('fr');
	const internal = generatorCatalog.listGenerators('en', { visibility: 'internal' });
	const all = generatorCatalog.listGenerators('en', { visibility: 'all' });
	assert.ok(englishPublic.length >= 23);
	assert.deepEqual(
		englishPublic.map(generator => generator.id).sort(),
		frenchPublic.map(generator => generator.id).sort(),
	);
	assert.equal(all.length, englishPublic.length + internal.length);
	assert.ok(internal.length > 0);
	assert.ok(internal.every(generator => generator.visibility === 'internal'));
	assert.deepEqual(
		new Set(internal.filter(generator => !generator.id.startsWith('background-'))
			.map(generator => [generator.id, generator.kind])),
		new Set([
			['creature-animal', 'component'],
			['creature-companion', 'component'],
			['creature-monster', 'component'],
			['modifier', 'modifier'],
			['site-modifier-all', 'modifier'],
			['site-modifier-building', 'modifier'],
			['site-modifier-interiors', 'modifier'],
			['site-modifier-structures', 'modifier'],
		]),
	);
	assert.equal(
		generatorResolver.generate(internal[0].id, 'en', { random: () => 0 }),
		null,
	);
	for (const generator of all) {
		assert.equal(generator.schemaVersion, 2);
		assert.match(generator.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
		assert.equal(
			new Set(generator.entries.map(entry => entry.id)).size,
			generator.entries.length,
		);
		assert.ok(generator.entries.every(entry => (
			typeof entry === 'object'
			&& /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id)
		)));
	}
	assert.throws(
		() => generatorResolver.generate('race', () => 0),
		/locale must be provided/,
	);
	assert.throws(
		() => generatorResolver.generate('race', 'en', () => 0),
		/options must be an object/,
	);
	assert.equal(generatorCatalog.generate, undefined);
	assert.equal(generatorCatalog.getCategory, undefined);
	assert.equal(generatorCatalog.listCategories, undefined);
	for (const randomValue of [0, 0.1, 0.5, 0.999999]) {
		assert.equal(
			generatorResolver.generate('race', 'en', { random: () => randomValue }).entryId,
			generatorResolver.generate('race', 'fr', { random: () => randomValue }).entryId,
		);
	}
});

test('generator and background autocomplete expose stable public values', () => {
	const publicValues = getCommandOptionValues('generator-categories', 'fr');
	const publicIds = new Set(
		generatorCatalog.listGenerators('en').map(generator => generator.id),
	);
	assert.deepEqual(
		new Set(publicValues.map(value => value.value)),
		publicIds,
	);
	assert.ok(publicValues.every(value => (
		generatorCatalog.getGenerator(value.value, 'en')?.visibility === 'public'
	)));

	const englishBackgrounds = generatorCatalog.getGenerator('background', 'en').entries;
	const frenchBackgrounds = generatorCatalog.getGenerator('background', 'fr').entries;
	const choices = AUTOCOMPLETE_PROVIDERS.backgrounds(
		{},
		{ locale: 'fr' },
		{ value: '' },
	);
	assert.deepEqual(
		choices.map(choice => choice.value),
		englishBackgrounds.map(entry => entry.id),
	);
	assert.ok(choices[0].name.startsWith(frenchBackgrounds[0].fields.Name));
});

test('generator schema validates v2 envelopes and kinds', () => {
	const english = createTextGenerator();
	assert.equal(validateGeneratorDefinition(english), english);

	for (const invalid of [
		{ ...english, schemaVersion: 1 },
		{ ...english, id: 'Invalid ID' },
		{ ...english, kind: 'template' },
		{ ...english, visibility: 'hidden' },
	]) {
		assert.throws(() => validateGeneratorDefinition(invalid), error => (
			error.name === 'GeneratorSchemaError'
		));
	}
});

test('generator schema validates entry schemas and payloads', () => {
	const english = createTextGenerator();
	for (const invalid of [
		{ ...english, entrySchema: { type: 'fields', required: [] } },
		{ ...english, entries: [{ id: 'rain', value: 'Rain', weight: 0 }] },
		{ ...english, entries: [{ id: 'rain', value: 'Rain' }, { id: 'rain', value: 'Storm' }] },
		{ ...english, entries: ['Legacy string'] },
	]) {
		assert.throws(() => validateGeneratorDefinition(invalid), error => (
			error.name === 'GeneratorSchemaError'
		));
	}

	const fields = createFieldsGenerator();
	assert.equal(validateGeneratorDefinition(fields), fields);
});

test('generator schema validates localized technical parity', () => {
	const english = createTextGenerator();
	const french = structuredClone(english);
	french.name = 'Météo';
	french.description = 'Conditions météorologiques';
	french.entries[0].value = 'Une pluie douce commence.';
	assert.equal(validateGeneratorPair(english, french, 'weather.json'), true);

	const fieldsEnglish = createFieldsGenerator();
	const fieldsFrench = structuredClone(fieldsEnglish);
	fieldsFrench.name = 'Armures';
	fieldsFrench.description = 'Armures disponibles';
	fieldsFrench.entries[0].fields.Name = 'Armure légère';
	assert.equal(validateGeneratorPair(fieldsEnglish, fieldsFrench), true);
	fieldsFrench.entries[0].fields.Type = 'léger';
	assert.throws(
		() => validateGeneratorPair(fieldsEnglish, fieldsFrench),
		error => error.code === 'GENERATOR_LOCALE_PARITY_MISMATCH',
	);
	fieldsFrench.entries[0].fields.Type = 'light';
	fieldsFrench.entries[0].id = 'armure-legere';
	assert.throws(
		() => validateGeneratorPair(fieldsEnglish, fieldsFrench),
		error => error.code === 'GENERATOR_LOCALE_PARITY_MISMATCH',
	);
});

test('recursive catalog discovery rejects a missing locale counterpart', async t => {
	const root = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'generator-v2-'));
	t.after(() => fsPromises.rm(root, { recursive: true, force: true }));
	await fsPromises.mkdir(path.join(root, 'en', 'nested'), { recursive: true });
	await fsPromises.mkdir(path.join(root, 'fr', 'nested'), { recursive: true });
	await fsPromises.writeFile(
		path.join(root, 'en', 'nested', 'weather.json'),
		JSON.stringify(createTextGenerator()),
	);
	assert.throws(
		() => generatorCatalog.createGeneratorCatalogCandidate(root),
		error => error.code === 'GENERATOR_LOCALE_FILE_MISMATCH',
	);

	const french = createTextGenerator();
	french.name = 'Météo';
	french.description = 'Conditions météorologiques';
	french.entries[0].value = 'Une pluie douce commence.';
	await fsPromises.writeFile(
		path.join(root, 'fr', 'nested', 'weather.json'),
		JSON.stringify(french),
	);
	const candidate = generatorCatalog.createGeneratorCatalogCandidate(root);
	assert.equal(candidate.get('en').get('weather').entries[0].id, 'gentle-rain');
	assert.equal(candidate.get('fr').get('weather').entries[0].value, 'Une pluie douce commence.');
});

test('weighted selection honors default weights and deterministic boundaries', () => {
	const entries = [
		{ id: 'first' },
		{ id: 'second', weight: 2 },
		{ id: 'third', weight: 1 },
	];
	assert.equal(getEntryWeight(entries[0]), 1);
	assert.equal(selectWeightedEntry(entries, () => 0), entries[0]);
	assert.equal(selectWeightedEntry(entries, () => 0.249999), entries[0]);
	assert.equal(selectWeightedEntry(entries, () => 0.25), entries[1]);
	assert.equal(selectWeightedEntry(entries, () => 0.75), entries[2]);
	assert.throws(() => selectWeightedEntry([]), /at least one entry/);
	assert.throws(
		() => selectWeightedEntry([{ id: 'invalid', weight: Number.POSITIVE_INFINITY }]),
		/positive finite/,
	);
});

test('statistical profile catalog validates and caches the balanced profile', () => {
	const balanced = statProfileCatalog.getStatProfile('character-balanced');
	assert.equal(balanced.id, 'character-balanced');
	assert.deepEqual(Object.keys(balanced.minimums), BASE_STATS);
	assert.ok(BASE_STATS.every(stat => (
		balanced.minimums[stat] === 4
		&& balanced.maximums[stat] === 20
		&& balanced.weights[stat] === 1
	)));
	assert.equal(
		statProfileCatalog.getStatProfile('character-balanced'),
		balanced,
	);
	statProfileCatalog.clearStatProfileCache();
	assert.notEqual(
		statProfileCatalog.getStatProfile('character-balanced'),
		balanced,
	);

	const valid = createStatProfileDocument();
	assert.equal(statProfileCatalog.validateStatProfileDocument(valid), valid);
	for (const invalid of [
		{ ...valid, schemaVersion: 2 },
		{ ...valid, profiles: [...valid.profiles, structuredClone(valid.profiles[0])] },
		{
			...valid,
			profiles: [{
				...valid.profiles[0],
				minimums: { ...valid.profiles[0].minimums, luck: 4 },
			}],
		},
		{
			...valid,
			profiles: [{
				...valid.profiles[0],
				minimums: { ...valid.profiles[0].minimums, constitution: 15 },
				maximums: { ...valid.profiles[0].maximums, constitution: 14 },
			}],
		},
		{
			...valid,
			profiles: [{
				...valid.profiles[0],
				weights: Object.fromEntries(BASE_STATS.map(stat => [stat, 0])),
			}],
		},
	]) {
		assert.throws(
			() => statProfileCatalog.validateStatProfileDocument(invalid),
			error => error.name === 'StatProfileError',
		);
	}
});

test('clearing the generator cache rebuilds both localized catalogs', () => {
	const englishBefore = generatorCatalog.getGenerator('weapons', 'en');
	const frenchBefore = generatorCatalog.getGenerator('weapons', 'fr');
	generatorCatalog.clearGeneratorCache();
	assert.notEqual(generatorCatalog.getGenerator('weapons', 'en'), englishBefore);
	assert.notEqual(generatorCatalog.getGenerator('weapons', 'fr'), frenchBefore);
});

function createTextGenerator() {
	return {
		schemaVersion: 2,
		id: 'weather',
		kind: 'category',
		visibility: 'public',
		name: 'Weather',
		description: 'Weather conditions',
		entrySchema: { type: 'text' },
		entries: [{ id: 'gentle-rain', weight: 2, value: 'A gentle rain begins.' }],
	};
}

function createFieldsGenerator() {
	return {
		schemaVersion: 2,
		id: 'armor',
		kind: 'category',
		visibility: 'public',
		name: 'Armor',
		description: 'Available armor',
		entrySchema: {
			type: 'fields',
			required: ['Name', 'Type'],
			technical: ['Type'],
		},
		entries: [{
			id: 'light-armor',
			fields: { Name: 'Light armor', Type: 'light' },
		}],
	};
}

function createStatProfileDocument() {
	return {
		schemaVersion: 1,
		profiles: [{
			id: 'test-profile',
			minimums: Object.fromEntries(BASE_STATS.map(stat => [stat, 4])),
			maximums: Object.fromEntries(BASE_STATS.map(stat => [stat, 20])),
			weights: Object.fromEntries(BASE_STATS.map(stat => [stat, 1])),
		}],
	};
}

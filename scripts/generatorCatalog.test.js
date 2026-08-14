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
	validateGeneratorRelationships,
} = require('../services/generatorSchema');
const {
	parseWrappedInlineReference,
} = require('../services/generatorSchema/referenceValidation');
const { BASE_STATS } = require('../services/mechanics/constants');
const statProfileCatalog = require('../services/statProfileCatalog');
const {
	getEntryWeight,
	selectWeightedEntry,
} = require('../services/weightedSelector');
const { getCommandOptionValues } = require('../util/commandOptionValues');

test('production generator v4 data uses stable IDs, entry names, strict parity, and visibility', () => {
	const englishPublic = generatorCatalog.listGenerators('en');
	const frenchPublic = generatorCatalog.listGenerators('fr');
	const internal = generatorCatalog.listGenerators('en', { visibility: 'internal' });
	const all = generatorCatalog.listGenerators('en', { visibility: 'all' });
	assert.ok(englishPublic.length > 0);
	assert.deepEqual(
		englishPublic.map(generator => generator.id).sort(),
		frenchPublic.map(generator => generator.id).sort(),
	);
	assert.equal(all.length, englishPublic.length + internal.length);
	assert.ok(internal.length > 0);
	assert.ok(internal.every(generator => generator.visibility === 'internal'));
	assert.equal(
		generatorResolver.generate(internal[0].id, 'en', { random: () => 0 }),
		null,
	);
	for (const generator of all) {
		assert.equal(generator.schemaVersion, 4);
		assert.match(generator.id, /^[a-z0-9]+(?:_[a-z0-9]+)*$/);
		assert.match(generator.name, /^\p{Lu}/u);
		assert.equal(
			new Set(generator.entries.map(entry => entry.id)).size,
			generator.entries.length,
		);
		assert.ok(generator.entries.every(entry => (
			typeof entry === 'object'
			&& /^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(entry.id)
			&& typeof entry.name === 'string'
			&& entry.name.trim()
		)));
	}
	for (const randomValue of [0, 0.1, 0.5, 0.999999]) {
		assert.equal(
			generatorResolver.generate('race', 'en', { random: () => randomValue }).entryId,
			generatorResolver.generate('race', 'fr', { random: () => randomValue }).entryId,
		);
	}
});

test('production category children use prefixed filenames and concept-only IDs', async () => {
	const backgroundIds = [
		'adventurer',
		'artisan',
		'criminal',
		'exile',
		'mage',
		'merchant',
		'military',
		'noble',
		'official',
		'outlander',
		'peasant',
		'performer',
		'religious',
		'sailor',
		'scholar',
		'servant',
		'urchin',
	];
	const expectedFiles = new Map([
		...backgroundIds.map(id => [`background_${id}.json`, id]),
		...['animal', 'companion', 'monster'].map(id => [`creature_${id}.json`, id]),
		...[
			'weapons',
			'shields',
			'armors',
			'supplies',
			'consumable',
			'food_and_drink',
			'valuables',
			'material',
			'curio',
		].map(id => [`loot_${id}.json`, id]),
		...['building', 'dungeon', 'settlement', 'region', 'room']
			.map(id => [`site_${id}.json`, id]),
		...['government', 'faction', 'religion']
			.map(id => [`group_${id}.json`, id]),
	]);
	const generatorRoot = path.join(__dirname, '..', 'data', 'generators');
	for (const locale of ['en', 'fr']) {
		const localeRoot = path.join(generatorRoot, locale);
		const filenames = new Set(await fsPromises.readdir(localeRoot));
		for (const [filename, id] of expectedFiles) {
			const document = JSON.parse(await fsPromises.readFile(
				path.join(localeRoot, filename),
				'utf8',
			));
			assert.equal(document.id, id, `${locale}/${filename}`);
		}
		for (const removedFilename of [
			'inventory.json',
			'weapons.json',
			'armors.json',
			'material.json',
			'building.json',
			'dungeon.json',
			'settlement.json',
			'region.json',
			'room.json',
			'government.json',
			'faction.json',
			'religion.json',
		]) {
			assert.equal(filenames.has(removedFilename), false, `${locale}/${removedFilename}`);
		}
	}
});

test('generator and background autocomplete expose stable public values', () => {
	const publicValues = getCommandOptionValues('generator-paths', 'fr');
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
	assert.ok(choices[0].name.startsWith(frenchBackgrounds[0].name));
});

test('wrapped inline reference parsing requires exactly one valid token', () => {
	assert.deepEqual(
		parseWrappedInlineReference('{{ monster:dragon.name }}'),
		{ generator: 'monster', entry: 'dragon', field: 'name' },
	);
	for (const invalid of [
		'monster',
		'{{ monster }} {{ animal }}',
		'{{ creature-monster }}',
	]) {
		assert.throws(
			() => parseWrappedInlineReference(invalid),
			error => error.code === 'INVALID_GENERATOR_INLINE_REFERENCE',
		);
	}
});

test('/gen traversal autocomplete follows entries, fields, and structural routes', () => {
	const complete = value => AUTOCOMPLETE_PROVIDERS['generator-paths'](
		{},
		{ locale: 'en' },
		{ value },
	).map(choice => choice.value);

	assert.ok(complete('').includes('modifier'));
	assert.ok(!complete('').includes('dungeon'));
	assert.ok(complete('background:').includes('background:criminal'));
	assert.deepEqual(complete('background:criminal.'), [
		'background:criminal.name',
		'background:criminal.description',
		'background:criminal.generator',
	]);
	assert.ok(complete('background:criminal.generator:')
		.includes('background:criminal.generator:pickpocket'));
	assert.deepEqual(complete('site:dungeon.generator.'), [
		'site:dungeon.generator.name',
		'site:dungeon.generator.description',
	]);
	assert.ok(complete('loot:shields.generator.')
		.includes('loot:shields.generator.ar_percentage'));
	assert.deepEqual(complete('loot:shields.generator:w'), [
		'loot:shields.generator:wooden_shield',
	]);
});

test('generator schema validates unified v4 envelopes', () => {
	const english = createTextGenerator();
	assert.equal(validateGeneratorDefinition(english), english);

	for (const invalid of [
		{ ...english, schemaVersion: 1 },
		{ ...english, id: 'Invalid ID' },
		{ ...english, name: 'weather' },
		{ ...english, kind: 'template' },
		{ ...english, visibility: 'hidden' },
	]) {
		assert.throws(() => validateGeneratorDefinition(invalid), error => (
			error.name === 'GeneratorSchemaError'
		));
	}
});

test('generator schema requires entry names and exact additional fields', () => {
	const english = createTextGenerator();
	for (const invalid of [
		{ ...english, entrySchema: { type: 'text' } },
		{ ...english, entries: [{ id: 'rain', name: 'Rain', value: 'Legacy' }] },
		{ ...english, entries: [{ id: 'rain', fields: { name: 'Rain' } }] },
		{ ...english, entries: [{ id: 'rain', name: '---' }] },
		{ ...english, entries: [{ id: 'rain', name: 'Rain', weight: 0 }] },
		{
			...english,
			entries: [
				{ id: 'rain', name: 'Rain' },
				{ id: 'rain', name: 'Storm' },
			],
		},
		{ ...english, entries: ['Legacy string'] },
	]) {
		assert.throws(() => validateGeneratorDefinition(invalid), error => (
			error.name === 'GeneratorSchemaError'
		));
	}

	const fields = createFieldsGenerator();
	assert.equal(validateGeneratorDefinition(fields), fields);
	assert.throws(
		() => validateGeneratorDefinition({
			...fields,
			entrySchema: { ...fields.entrySchema, technical: ['type'] },
		}),
		error => error.name === 'GeneratorSchemaError',
	);
	for (const reservedField of ['name', 'generator', 'generation']) {
		assert.throws(
			() => validateGeneratorDefinition({
				...fields,
				entrySchema: {
					...fields.entrySchema,
					required: [...fields.entrySchema.required, reservedField],
				},
			}),
			error => error.name === 'GeneratorSchemaError',
		);
	}
	for (const invalidEntries of [
		[{ id: 'light_armor', name: 'Light armor' }],
		[{
			id: 'light_armor',
			name: 'Light armor',
			fields: { type: 'light', description: 'Extra' },
		}],
		[{
			id: 'light_armor',
			name: 'Light armor',
			fields: { type: 'light', name: 'Legacy duplicate' },
		}],
	]) {
		assert.throws(
			() => validateGeneratorDefinition({ ...fields, entries: invalidEntries }),
			error => error.name === 'GeneratorSchemaError',
		);
	}
	for (const modifiers of [
		[],
		{ quest_modifier: -1 },
		{ quest_modifier: 101 },
		{ 'Invalid ID': 50 },
	]) {
		assert.throws(
			() => validateGeneratorDefinition({ ...english, modifiers }),
			error => error.name === 'GeneratorSchemaError',
		);
	}
});

test('generator schema allows at most 24 additional fields beside the name', () => {
	const createBoundaryGenerator = count => {
		const required = Array.from(
			{ length: count },
			(_, index) => `field_${index + 1}`,
		);
		return {
			...createFieldsGenerator(),
			entrySchema: { required },
			entries: [{
				id: 'boundary_entry',
				name: 'Boundary entry',
				fields: Object.fromEntries(required.map(field => [field, 'value'])),
			}],
		};
	};

	const maximum = createBoundaryGenerator(24);
	assert.equal(validateGeneratorDefinition(maximum), maximum);
	assert.throws(
		() => validateGeneratorDefinition(createBoundaryGenerator(25)),
		error => error.code === 'INVALID_GENERATOR_ENTRY_SCHEMA',
	);
});

test('generator schema localizes string fields and preserves functional parity', () => {
	const english = createTextGenerator();
	const french = structuredClone(english);
	french.name = 'M\u00e9t\u00e9o';
	french.description = 'Conditions m\u00e9t\u00e9orologiques';
	french.entries[0].name = 'Une pluie douce commence.';
	assert.equal(validateGeneratorPair(english, french, 'weather.json'), true);

	const fieldsEnglish = createFieldsGenerator();
	const fieldsFrench = structuredClone(fieldsEnglish);
	fieldsFrench.name = 'Armures';
	fieldsFrench.description = 'Armures disponibles';
	fieldsFrench.entries[0].name = 'Armure l\u00e9g\u00e8re';
	fieldsFrench.entries[0].fields.type = 'l\u00e9ger';
	assert.equal(validateGeneratorPair(fieldsEnglish, fieldsFrench), true);
	fieldsEnglish.entries[0].generator = 'armor_detail';
	fieldsFrench.entries[0].generator = 'armure_detail';
	assert.throws(
		() => validateGeneratorPair(fieldsEnglish, fieldsFrench),
		error => error.code === 'GENERATOR_LOCALE_PARITY_MISMATCH',
	);
	fieldsFrench.entries[0].generator = 'armor_detail';
	fieldsFrench.entries[0].id = 'armure_legere';
	assert.throws(
		() => validateGeneratorPair(fieldsEnglish, fieldsFrench),
		error => error.code === 'GENERATOR_LOCALE_PARITY_MISMATCH',
	);
});

test('generator names reject normalized collisions within their input scope', () => {
	const entries = createTextGenerator();
	entries.entries.push({ id: 'second_rain', name: '  À gentle---&---RAIN begins  ' });
	assert.throws(
		() => validateGeneratorDefinition(entries),
		error => error.code === 'DUPLICATE_GENERATOR_ENTRY_NAME',
	);

	const first = createTextGenerator();
	const second = {
		...createTextGenerator(),
		id: 'climate',
		name: 'Wéather!',
	};
	assert.throws(
		() => validateGeneratorRelationships(new Map([
			[first.id, first],
			[second.id, second],
		])),
		error => error.code === 'DUPLICATE_PUBLIC_GENERATOR_NAME',
	);
});

test('recursive catalog discovery rejects a missing locale counterpart', async t => {
	const root = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'generator-v4-'));
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
	french.entries[0].name = 'Une pluie douce commence.';
	await fsPromises.writeFile(
		path.join(root, 'fr', 'nested', 'weather.json'),
		JSON.stringify(french),
	);
	const candidate = generatorCatalog.createGeneratorCatalogCandidate(root);
	assert.equal(candidate.get('en').get('weather').entries[0].id, 'gentle_rain');
	assert.equal(candidate.get('fr').get('weather').entries[0].name, 'Une pluie douce commence.');
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
		schemaVersion: 4,
		id: 'weather',
		visibility: 'public',
		name: 'Weather',
		description: 'Weather conditions',
		entrySchema: { required: [] },
		entries: [{ id: 'gentle_rain', name: 'A gentle rain begins.', weight: 2 }],
	};
}

function createFieldsGenerator() {
	return {
		schemaVersion: 4,
		id: 'armor',
		visibility: 'public',
		name: 'Armor',
		description: 'Available armor',
		entrySchema: {
			required: ['type'],
		},
		entries: [{
			id: 'light_armor',
			name: 'Light armor',
			fields: { type: 'light' },
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

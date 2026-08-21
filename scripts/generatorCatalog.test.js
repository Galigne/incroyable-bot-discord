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
	createGeneratorTraversalAlias,
	getGeneratorTraversalSuggestions,
} = require('../services/generatorTraversal');
const {
	isGeneratorRouter,
	validateBackgroundStatProfileRelationships,
	validateGeneratorDefinition,
	validateGeneratorPair,
	validateGeneratorRelationships,
	validateRoutedArchetypeStatProfileRelationships,
} = require('../services/generatorSchema');
const {
	parseWrappedInlineReference,
} = require('../services/generatorSchema/referenceValidation');
const { BASE_STATS } = require('../services/mechanics/constants');
const {
	DEFAULT_STAT_PROFILE_ID,
	getGenerationStatProfileId,
} = require('../services/generationMetadata');
const statProfileCatalog = require('../services/statProfileCatalog');
const {
	getEntryWeight,
	selectWeightedEntry,
} = require('../services/weightedSelector');
const { getCommandOptionValues } = require('../util/commandOptionValues');

test('routed background and creature archetypes share profile relationship validation', () => {
	const catalogs = generatorCatalog.createGeneratorCatalogCandidate();
	const profiles = statProfileCatalog.createStatProfileCandidate();
	assert.equal(
		validateRoutedArchetypeStatProfileRelationships(catalogs, profiles),
		true,
	);

	const backgroundCatalogs = cloneCatalogs(catalogs);
	const backgroundRoute = backgroundCatalogs.get('en').get('background').entries[0];
	const backgroundGenerator = structuredClone(
		backgroundCatalogs.get('en').get(backgroundRoute.generator),
	);
	delete backgroundGenerator.entries[0].generation;
	backgroundCatalogs.get('en').set(backgroundRoute.generator, backgroundGenerator);
	const backgroundWithoutDefault = new Map(profiles);
	backgroundWithoutDefault.delete(DEFAULT_STAT_PROFILE_ID);
	assert.throws(
		() => validateRoutedArchetypeStatProfileRelationships(
			backgroundCatalogs,
			backgroundWithoutDefault,
		),
		error => error.code === 'BACKGROUND_STAT_PROFILE_MISSING',
	);

	const creatureCatalogs = cloneCatalogs(catalogs);
	const creatureRoute = creatureCatalogs.get('en').get('creature').entries[0];
	const creatureGenerator = structuredClone(
		creatureCatalogs.get('en').get(creatureRoute.generator),
	);
	creatureGenerator.entries[0].generation = {
		...creatureGenerator.entries[0].generation,
		statProfile: 'missing-profile',
	};
	creatureCatalogs.get('en').set(creatureRoute.generator, creatureGenerator);
	assert.throws(
		() => validateRoutedArchetypeStatProfileRelationships(
			creatureCatalogs,
			profiles,
		),
		error => error.code === 'CREATURE_STAT_PROFILE_MISSING',
	);
});

test('background archetypes define optional localized generation metadata', () => {
	const catalogs = generatorCatalog.createGeneratorCatalogCandidate();
	const profiles = statProfileCatalog.createStatProfileCandidate();
	const englishRouter = catalogs.get('en').get('background');
	const frenchRouter = catalogs.get('fr').get('background');
	assert.deepEqual(
		englishRouter.entries.map(entry => entry.generator),
		frenchRouter.entries.map(entry => entry.generator),
	);
	for (const route of englishRouter.entries) {
		const english = catalogs.get('en').get(route.generator);
		const french = catalogs.get('fr').get(route.generator);
		assert.equal(english.visibility, 'internal');
		assert.deepEqual(english.entrySchema.required, []);
		assert.deepEqual(
			english.entries.map(entry => entry.id),
			french.entries.map(entry => entry.id),
		);
		for (const [index, entry] of english.entries.entries()) {
			assert.deepEqual(
				Object.keys(entry.generation ?? {}),
				Object.keys(french.entries[index].generation ?? {}),
			);
			const profileId = getGenerationStatProfileId(entry.generation);
			assert.ok(profiles.has(profileId));
			assert.equal(
				getGenerationStatProfileId(french.entries[index].generation),
				profileId,
			);
			assert.equal(Object.hasOwn(entry.generation ?? {}, 'traits'), false);
		}
	}
	assert.equal(
		validateBackgroundStatProfileRelationships(catalogs, profiles),
		true,
	);
});

test('background metadata supports optional shared overrides and rejects traits or invalid profiles', () => {
	const catalogs = generatorCatalog.createGeneratorCatalogCandidate();
	const generatorId = catalogs.get('en').get('background').entries[0].generator;
	const validationOptions = { backgroundGeneratorIds: new Set([generatorId]) };
	const english = structuredClone(catalogs.get('en').get(generatorId));
	const french = structuredClone(catalogs.get('fr').get(generatorId));
	delete english.locale;
	delete french.locale;

	const missing = structuredClone(english);
	delete missing.entries[0].generation;
	assert.doesNotThrow(
		() => validateGeneratorDefinition(missing, '<generator>', validationOptions),
	);

	const sharedOverrides = structuredClone(english);
	sharedOverrides.entries[0].generation = {
		naturalArmorPercentage: 20,
		talents: ['{{ talents:athlete }}'],
		fixedRules: [],
		statusEffects: [],
		modifiers: [],
		armor: 'armors:padded_armor',
		equipment: [],
		inventory: [],
	};
	assert.doesNotThrow(
		() => validateGeneratorDefinition(
			sharedOverrides,
			'<generator>',
			validationOptions,
		),
	);

	const legacyReference = structuredClone(sharedOverrides);
	legacyReference.entries[0].generation.armor = {
		generator: 'armors',
		entry: 'padded_armor',
		select: 'fields',
	};
	assert.throws(
		() => validateGeneratorDefinition(
			legacyReference,
			'<generator>',
			validationOptions,
		),
		error => error.code === 'INVALID_GENERATOR_REFERENCE',
	);

	const weightedReference = structuredClone(sharedOverrides);
	weightedReference.entries[0].generation.inventory = [{
		generator: {
			oneOf: [
				{ id: 'supplies', weight: 3 },
				{ id: 'weapons', weight: 1 },
			],
		},
		select: 'fields',
	}];
	assert.doesNotThrow(
		() => validateGeneratorDefinition(
			weightedReference,
			'<generator>',
			validationOptions,
		),
	);

	const creatureSpecific = structuredClone(sharedOverrides);
	creatureSpecific.entries[0].generation.traits = [];
	assert.throws(
		() => validateGeneratorDefinition(
			creatureSpecific,
			'<generator>',
			validationOptions,
		),
		error => error.name === 'GeneratorSchemaError',
	);
	const invalidProfile = structuredClone(english);
	invalidProfile.entries[0].generation = { statProfile: 'Invalid profile' };
	assert.throws(
		() => validateGeneratorDefinition(
			invalidProfile,
			'<generator>',
			validationOptions,
		),
		error => error.code === 'INVALID_GENERATION_STAT_PROFILE',
	);
	const englishTalents = structuredClone(english);
	const frenchTalents = structuredClone(french);
	englishTalents.entries[0].generation = {
		talents: ['Gifted: {{ talents:athlete }}'],
	};
	frenchTalents.entries[0].generation = {
		talents: ['Doué : {{ talents:athlete }}'],
	};
	assert.doesNotThrow(() => validateGeneratorPair(
		englishTalents,
		frenchTalents,
		'<generator>',
		validationOptions,
	));
	frenchTalents.entries[0].generation.talents = [
		'Doué : {{ talents:keen_eye }}',
	];
	assert.throws(
		() => validateGeneratorPair(
			englishTalents,
			frenchTalents,
			'<generator>',
			validationOptions,
		),
		error => error.code === 'GENERATOR_LOCALE_PARITY_MISMATCH',
	);

	const relationshipCatalog = new Map(catalogs.get('en'));
	const invalidRelationships = structuredClone(
		relationshipCatalog.get(generatorId),
	);
	invalidRelationships.entries[0].generation = {
		statusEffects: ['faction'],
	};
	relationshipCatalog.set(generatorId, invalidRelationships);
	assert.throws(
		() => validateGeneratorRelationships(relationshipCatalog),
		error => error.code === 'INVALID_GENERATION_REFERENCE_TARGET',
	);

	const mismatchedEnglish = structuredClone(english);
	const mismatchedFrench = structuredClone(french);
	mismatchedEnglish.entries[0].generation = { statProfile: 'profile-one' };
	mismatchedFrench.entries[0].generation = { statProfile: 'profile-two' };
	assert.throws(
		() => validateGeneratorPair(
			mismatchedEnglish,
			mismatchedFrench,
			'<generator>',
			validationOptions,
		),
		error => error.code === 'GENERATOR_LOCALE_PARITY_MISMATCH',
	);

	const catalogsUsingDefault = cloneCatalogs(catalogs);
	const defaultGenerator = structuredClone(
		catalogsUsingDefault.get('en').get(generatorId),
	);
	delete defaultGenerator.entries[0].generation;
	catalogsUsingDefault.get('en').set(generatorId, defaultGenerator);
	const profiles = statProfileCatalog.createStatProfileCandidate();
	profiles.delete(DEFAULT_STAT_PROFILE_ID);
	assert.throws(
		() => validateBackgroundStatProfileRelationships(catalogsUsingDefault, profiles),
		error => error.code === 'BACKGROUND_STAT_PROFILE_MISSING',
	);
});

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
	const generatorRoot = path.join(__dirname, '..', 'data', 'generators');
	for (const locale of ['en', 'fr']) {
		const localeRoot = path.join(generatorRoot, locale);
		const filenames = new Set(await fsPromises.readdir(localeRoot));
		for (const routerId of [
			'background',
			'creature',
			'loot',
			'site',
			'group',
			'modifier',
			'aspect',
		]) {
			const router = generatorCatalog.getGenerator(routerId, locale);
			for (const route of router.entries) {
				const filename = getCategoryChildFilename(routerId, route.generator);
				const document = JSON.parse(await fsPromises.readFile(
					path.join(localeRoot, filename),
					'utf8',
				));
				assert.equal(document.id, route.generator, `${locale}/${filename}`);
				const obsoleteFilename = `${route.generator}.json`;
				if (obsoleteFilename !== filename) {
					assert.equal(
						filenames.has(obsoleteFilename),
						false,
						`${locale}/${obsoleteFilename}`,
					);
				}
			}
		}
	}
});

test('generator autocomplete and help expose localized public aliases', () => {
	const frenchGenerators = generatorCatalog.listGenerators('fr');
	const publicValues = getCommandOptionValues('generator-paths', 'fr');
	assert.deepEqual(
		publicValues.map(value => value.value),
		frenchGenerators.map(generator => createGeneratorTraversalAlias(generator.name)),
	);
	assert.ok(publicValues.some(value => value.value === 'aspects'));
	assert.ok(['aptitudes', 'éléments', 'faiblesses'].every(alias => (
		!publicValues.some(value => value.value === alias)
	)));
	assert.ok(publicValues.every(value => value.name === value.value));

	const frenchBackgrounds = generatorCatalog.getGenerator('background', 'fr').entries;
	const choices = AUTOCOMPLETE_PROVIDERS.backgrounds(
		{},
		{ locale: 'fr' },
		{ value: '' },
	);
	assert.deepEqual(
		choices.map(choice => choice.value),
		frenchBackgrounds.map(entry => createGeneratorTraversalAlias(entry.name)),
	);
	assert.equal(choices[0].name, choices[0].value);
	const firstBackgroundPath = createGeneratorTraversalAlias(frenchBackgrounds[0].name);
	const backgroundEntries = AUTOCOMPLETE_PROVIDERS.backgrounds(
		{},
		{ locale: 'fr' },
		{ value: `${firstBackgroundPath}:` },
	);
	assert.ok(backgroundEntries.length > 0);
	assert.ok(backgroundEntries.every(choice => (
		choice.value.startsWith(`${firstBackgroundPath}:`)
	)));

	const frenchCreatureRoutes = generatorCatalog.getGenerator('creature', 'fr').entries;
	const firstCreaturePath = createGeneratorTraversalAlias(frenchCreatureRoutes[0].name);
	const creatureEntries = AUTOCOMPLETE_PROVIDERS['creature-types'](
		{},
		{ locale: 'fr' },
		{ value: `${firstCreaturePath}:` },
	);
	assert.ok(creatureEntries.length > 0);
	assert.ok(creatureEntries.every(choice => (
		choice.value.startsWith(`${firstCreaturePath}:`)
	)));
});

test('wrapped inline reference parsing requires exactly one valid token', () => {
	assert.deepEqual(
		parseWrappedInlineReference('{{ monster:dragon.name }}'),
		{
			rootId: 'monster',
			operations: [{ type: 'selection', entryId: 'dragon' }],
			field: 'name',
			path: 'monster:dragon.name',
		},
	);
	assert.deepEqual(
		parseWrappedInlineReference(
			'{{ creature:monster.generator:dragon.description }}',
		),
		{
			rootId: 'creature',
			operations: [
				{ type: 'selection', entryId: 'monster' },
				{ type: 'route' },
				{ type: 'selection', entryId: 'dragon' },
			],
			field: 'description',
			path: 'creature:monster.generator:dragon.description',
		},
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

	const background = getRoutedFixture('background', 'en');
	assert.ok(complete(`${background.rootAlias}:`).includes(
		`${background.rootAlias}:${background.routeAlias}`,
	));
	assert.deepEqual(complete(`${background.rootAlias}:${background.routeAlias}.`), [
		`${background.rootAlias}:${background.routeAlias}.name`,
	]);
	assert.ok(complete(`${background.rootAlias}:${background.routeAlias}:`).includes(
		`${background.rootAlias}:${background.routeAlias}:${background.entryAlias}`,
	));

	const loot = getRoutedFixture(
		'loot',
		'en',
		child => child.entrySchema.required.includes('description'),
	);
	assert.ok(complete(`${loot.rootAlias}:${loot.routeAlias}.`).includes(
		`${loot.rootAlias}:${loot.routeAlias}.description`,
	));
	assert.deepEqual(
		complete(`${loot.rootAlias}:${loot.routeAlias}:${loot.entryAlias}`),
		[`${loot.rootAlias}:${loot.routeAlias}:${loot.entryAlias}`],
	);
	assert.deepEqual(complete(`${loot.rootAlias}.`), [`${loot.rootAlias}.generator`]);
	assert.ok(!complete(`${loot.rootAlias}:${loot.routeAlias}.`).includes(
		`${loot.rootAlias}:${loot.routeAlias}.generator`,
	));
	assert.deepEqual(
		complete(`${loot.rootAlias}:${loot.routeAlias}.generator:`),
		[],
	);
});

test('localized generator aliases are predictable and resolve to stable identities', () => {
	assert.equal(
		createGeneratorTraversalAlias('  L\'Épée—longue !  '),
		'l_épée_longue',
	);
	const englishFixture = getRoutedFixture('loot', 'en');
	const frenchFixture = getRoutedFixture('loot', 'fr', child => (
		child.id === englishFixture.child.id
	));
	const englishPath = `${englishFixture.rootAlias}:${englishFixture.routeAlias}`;
	const frenchPath = `${frenchFixture.rootAlias}:${frenchFixture.routeAlias}`;
	const english = generatorResolver.generate(englishPath, 'en', {
		random: () => 0,
	});
	const french = generatorResolver.generate(frenchPath, 'fr', {
		random: () => 0,
	});
	assert.equal(english.generatorId, englishFixture.route.generator);
	assert.equal(french.generatorId, englishFixture.route.generator);
	assert.equal(english.entryId, englishFixture.entry.id);
	assert.equal(french.entryId, englishFixture.entry.id);
	assert.equal(
		generatorResolver.generate(frenchPath.toLocaleUpperCase('fr'), 'fr', {
			random: () => 0,
		})
			.generatorId,
		englishFixture.route.generator,
	);
});

test('/gen autocomplete uses localized paths and active accent-insensitive segments', () => {
	const localized = createTextGenerator();
	localized.id = 'event';
	localized.name = 'Événements';
	localized.entries = [{ id: 'long_sword', name: 'Épée longue' }];
	const options = {
		getGenerator: id => id === localized.id ? localized : undefined,
		listGenerators: () => [localized],
	};
	assert.deepEqual(
		getGeneratorTraversalSuggestions('evenements', 'fr', options)
			.map(choice => choice.value),
		['événements'],
	);
	assert.deepEqual(
		getGeneratorTraversalSuggestions('evenements:epee', 'fr', options)
			.map(choice => choice.value),
		['événements:épée_longue'],
	);
});

test('localized traversal continues through routes and keeps stable field syntax', () => {
	const fixture = getRoutedFixture(
		'loot',
		'fr',
		child => child.entrySchema.required.includes('description'),
	);
	const localizedPath = [
		`${fixture.rootAlias}:${fixture.routeAlias}:${fixture.entryAlias}`,
		'description',
	].join('.');
	const result = generatorResolver.generate(
		localizedPath,
		'fr',
		{ random: () => 0 },
	);
	assert.equal(result.generatorId, fixture.route.generator);
	assert.equal(result.entryId, fixture.entry.id);
	assert.deepEqual(
		result.fields,
		generatorResolver.generate(
			`loot:${fixture.route.id}:${fixture.entry.id}.description`,
			'fr',
			{ random: () => 0 },
		).fields,
	);
	assert.deepEqual(
		generatorResolver.generate(
			`${fixture.rootAlias}:${fixture.routeAlias}:${fixture.entryAlias}.name`,
			'fr',
			{ random: () => 0 },
		).fields,
		{ name: fixture.entry.name },
	);
	assert.equal(
		generatorResolver.generate(
			`loot:${fixture.route.id}.generator:${fixture.entry.id}.name`,
			'fr',
			{ random: () => 0 },
		).entryId,
		fixture.entry.id,
	);
});

test('generator autocomplete searches all entries before applying the result limit', () => {
	const generator = createTextGenerator();
	generator.id = 'large_catalog';
	generator.name = 'Large catalog';
	generator.entries = Array.from({ length: 30 }, (_, index) => ({
		id: `choice_${index + 1}`,
		name: index === 29 ? 'Needle entry' : `Ordinary choice ${index + 1}`,
	}));
	const suggestions = getGeneratorTraversalSuggestions(
		'large_catalog:needle',
		'en',
		{
			getGenerator: id => id === generator.id ? generator : undefined,
			listGenerators: () => [generator],
		},
	);
	assert.deepEqual(suggestions.map(choice => choice.value), [
		'large_catalog:needle_entry',
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

test('generator routers are structural, complete, and minimal', () => {
	const router = createRouterGenerator();
	assert.equal(isGeneratorRouter(router), true);
	assert.equal(validateGeneratorDefinition(router), router);
	assert.equal(isGeneratorRouter(createTextGenerator()), false);

	const mixed = structuredClone(router);
	delete mixed.entries[1].generator;
	assert.throws(
		() => validateGeneratorDefinition(mixed),
		error => error.code === 'INVALID_GENERATOR_ROUTER_SCHEMA',
	);

	const fields = structuredClone(router);
	fields.entries[0].fields = {};
	assert.throws(
		() => validateGeneratorDefinition(fields),
		error => error.code === 'INVALID_GENERATOR_STRUCTURE',
	);

	const required = structuredClone(router);
	required.entrySchema.required = ['description'];
	assert.throws(
		() => validateGeneratorDefinition(required),
		error => error.code === 'INVALID_GENERATOR_ROUTER_SCHEMA',
	);

	const routedContent = createFieldsGenerator();
	routedContent.entries[0].generator = 'armor_detail';
	assert.throws(
		() => validateGeneratorDefinition(routedContent),
		error => error.code === 'INVALID_GENERATOR_ROUTER_SCHEMA',
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
	fieldsFrench.entries[0].id = 'armure_legere';
	assert.throws(
		() => validateGeneratorPair(fieldsEnglish, fieldsFrench),
		error => error.code === 'GENERATOR_LOCALE_PARITY_MISMATCH',
	);

	const routerEnglish = createRouterGenerator();
	const routerFrench = structuredClone(routerEnglish);
	routerFrench.name = 'Aiguillage';
	routerFrench.description = 'Routes disponibles';
	routerFrench.entries[0].name = 'Gauche';
	routerFrench.entries[1].name = 'Droite';
	assert.equal(validateGeneratorPair(routerEnglish, routerFrench), true);
	routerFrench.entries[0].generator = 'autre_enfant';
	assert.throws(
		() => validateGeneratorPair(routerEnglish, routerFrench),
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

	const internalOutcomes = createTextGenerator();
	internalOutcomes.visibility = 'internal';
	internalOutcomes.entries.push({
		id: 'second_rain',
		name: internalOutcomes.entries[0].name,
	});
	assert.equal(validateGeneratorDefinition(internalOutcomes), internalOutcomes);

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

	const entryAliasConflict = createTextGenerator();
	entryAliasConflict.entries = [
		{ id: 'first', name: 'Storm' },
		{ id: 'storm', name: 'Drizzle' },
	];
	assert.throws(
		() => validateGeneratorDefinition(entryAliasConflict),
		error => error.code === 'AMBIGUOUS_GENERATOR_ENTRY_ALIAS',
	);

	const generatorAliasConflict = createTextGenerator();
	generatorAliasConflict.name = 'Climate';
	const stableClimate = {
		...createTextGenerator(),
		id: 'climate',
		name: 'Storms',
	};
	assert.throws(
		() => validateGeneratorRelationships(new Map([
			[generatorAliasConflict.id, generatorAliasConflict],
			[stableClimate.id, stableClimate],
		])),
		error => error.code === 'AMBIGUOUS_PUBLIC_GENERATOR_ALIAS',
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

test('statistical profile catalog validates and caches the default profile', () => {
	const defaultProfile = statProfileCatalog.getStatProfile(DEFAULT_STAT_PROFILE_ID);
	assert.equal(defaultProfile.id, DEFAULT_STAT_PROFILE_ID);
	assert.deepEqual(Object.keys(defaultProfile.minimums), BASE_STATS);
	assert.ok(BASE_STATS.every(stat => (
		Number.isFinite(defaultProfile.minimums[stat])
		&& Number.isFinite(defaultProfile.maximums[stat])
		&& Number.isFinite(defaultProfile.weights[stat])
		&& defaultProfile.minimums[stat] <= defaultProfile.maximums[stat]
		&& defaultProfile.weights[stat] >= 0
	)));
	assert.ok(BASE_STATS.some(stat => defaultProfile.weights[stat] > 0));
	assert.equal(
		statProfileCatalog.getStatProfile(DEFAULT_STAT_PROFILE_ID),
		defaultProfile,
	);
	statProfileCatalog.clearStatProfileCache();
	assert.notEqual(
		statProfileCatalog.getStatProfile(DEFAULT_STAT_PROFILE_ID),
		defaultProfile,
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
	const generatorId = generatorCatalog.listGenerators('en')[0].id;
	const englishBefore = generatorCatalog.getGenerator(generatorId, 'en');
	const frenchBefore = generatorCatalog.getGenerator(generatorId, 'fr');
	generatorCatalog.clearGeneratorCache();
	assert.notEqual(generatorCatalog.getGenerator(generatorId, 'en'), englishBefore);
	assert.notEqual(generatorCatalog.getGenerator(generatorId, 'fr'), frenchBefore);
});

function cloneCatalogs(catalogs) {
	return new Map([...catalogs].map(([locale, catalog]) => [
		locale,
		new Map(catalog),
	]));
}

function getCategoryChildFilename(routerId, childId) {
	return `${childId.startsWith(`${routerId}_`) ? childId : `${routerId}_${childId}`}.json`;
}

function getRoutedFixture(rootId, locale, acceptsChild = () => true) {
	const root = generatorCatalog.getGenerator(rootId, locale);
	const route = root.entries.find(candidate => (
		acceptsChild(generatorCatalog.getGenerator(candidate.generator, locale))
	));
	const child = generatorCatalog.getGenerator(route.generator, locale);
	const entry = child.entries[0];
	return {
		child,
		entry,
		entryAlias: createGeneratorTraversalAlias(entry.name),
		root,
		rootAlias: createGeneratorTraversalAlias(root.name),
		route,
		routeAlias: createGeneratorTraversalAlias(route.name),
	};
}

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

function createRouterGenerator() {
	return {
		schemaVersion: 4,
		id: 'router',
		visibility: 'public',
		name: 'Router',
		description: 'Available routes',
		entrySchema: { required: [] },
		entries: [
			{ id: 'left', name: 'Left', generator: 'left_child' },
			{ id: 'right', name: 'Right', weight: 2, generator: 'right_child' },
		],
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

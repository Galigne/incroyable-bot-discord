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
} = require('../services/generatorTraversal');
const {
	isGeneratorRouter,
	validateBackgroundStatProfileRelationships,
	validateGeneratorDefinition,
	validateGeneratorPair,
	validateGeneratorRelationships,
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

test('background archetypes define optional localized generation metadata', () => {
	const catalogs = generatorCatalog.createGeneratorCatalogCandidate();
	const profiles = statProfileCatalog.createStatProfileCandidate();
	const usedProfileIds = new Set();
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
			assert.deepEqual(Object.keys(entry.generation ?? {}), entry.generation
				? ['statProfile']
				: []);
			assert.deepEqual(entry.generation, french.entries[index].generation);
			const profileId = getGenerationStatProfileId(entry.generation);
			assert.ok(profiles.has(profileId));
			usedProfileIds.add(profileId);
		}
	}
	assert.deepEqual([...usedProfileIds].sort(), [
		'character-cleric',
		'character-diplomat',
		'character-fighter',
		'character-mage',
		'character-rogue',
		DEFAULT_STAT_PROFILE_ID,
	]);
	const militaryProfiles = new Map(
		catalogs.get('en').get('military').entries.map(entry => [
			entry.id,
			entry.generation.statProfile,
		]),
	);
	assert.equal(militaryProfiles.get('soldier'), 'character-fighter');
	assert.equal(militaryProfiles.get('military_engineer'), 'character-mage');
	assert.equal(militaryProfiles.get('quartermaster'), 'character-diplomat');
	assert.equal(militaryProfiles.get('military_scout'), 'character-rogue');
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
		armor: {
			generator: 'armors',
			entry: 'common_light_armor',
			select: 'fields',
		},
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
		statusEffects: [{ generator: 'faction', select: 'fields' }],
	};
	relationshipCatalog.set(generatorId, invalidRelationships);
	assert.throws(
		() => validateGeneratorRelationships(relationshipCatalog),
		error => error.code === 'INVALID_GENERATION_REFERENCE_TARGET',
	);

	const explicitIndex = french.entries.findIndex(entry => entry.generation?.statProfile);
	const originalProfileId = french.entries[explicitIndex].generation.statProfile;
	french.entries[explicitIndex].generation.statProfile = originalProfileId === 'character-fighter'
		? 'character-rogue'
		: 'character-fighter';
	assert.throws(
		() => validateGeneratorPair(
			english,
			french,
			'<generator>',
			validationOptions,
		),
		error => error.code === 'GENERATOR_LOCALE_PARITY_MISMATCH',
	);

	const profiles = statProfileCatalog.createStatProfileCandidate();
	profiles.delete(DEFAULT_STAT_PROFILE_ID);
	assert.throws(
		() => validateBackgroundStatProfileRelationships(catalogs, profiles),
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

test('generator autocomplete and help expose localized public aliases', () => {
	const frenchGenerators = generatorCatalog.listGenerators('fr');
	const publicValues = getCommandOptionValues('generator-paths', 'fr');
	assert.deepEqual(
		publicValues.map(value => value.value),
		frenchGenerators.map(generator => createGeneratorTraversalAlias(generator.name)),
	);
	assert.ok(publicValues.some(value => value.value === 'butin'));
	assert.ok(publicValues.every(value => value.name === value.value));

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
	assert.equal(choices[0].name, frenchBackgrounds[0].name);
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
	]);
	assert.ok(complete('background:criminal:')
		.includes('background:criminal:pickpocket'));
	assert.deepEqual(complete('site:dungeon.'), [
		'site:dungeon.name',
		'site:dungeon.description',
	]);
	assert.ok(complete('loot:shields.')
		.includes('loot:shields.ar_percentage'));
	assert.deepEqual(complete('loot:shields:w'), [
		'loot:shields:wooden_shield',
		'loot:shields:tower_shield',
		'loot:shields:stormward_shield',
		'loot:shields:living_wood_shield',
	]);
	assert.deepEqual(complete('loot:shields:wooden_shield'), [
		'loot:shields:wooden_shield',
	]);
	assert.deepEqual(complete('loot.'), ['loot.generator']);
	assert.ok(!complete('loot.').includes('loot.name'));
	assert.ok(!complete('loot:weapons.').includes('loot:weapons.generator'));
	assert.deepEqual(complete('loot:weapons.generator:'), []);
});

test('localized generator aliases are predictable and resolve to stable identities', () => {
	assert.equal(
		createGeneratorTraversalAlias('  L\'Épée—longue !  '),
		'l_épée_longue',
	);
	const english = generatorResolver.generate('loot:shields', 'en', {
		random: () => 0,
	});
	const french = generatorResolver.generate('butin:boucliers', 'fr', {
		random: () => 0,
	});
	assert.equal(english.generatorId, 'shields');
	assert.equal(french.generatorId, 'shields');
	assert.equal(english.entryId, 'common_buckler');
	assert.equal(french.entryId, 'common_buckler');
	assert.equal(
		generatorResolver.generate('BuTiN:BOUCLIERS', 'fr', { random: () => 0 })
			.generatorId,
		'shields',
	);
});

test('/gen autocomplete uses localized paths and active accent-insensitive segments', () => {
	const complete = value => AUTOCOMPLETE_PROVIDERS['generator-paths'](
		{},
		{ locale: 'fr' },
		{ value },
	);
	assert.deepEqual(complete('butin:bou'), [{
		name: 'butin:boucliers',
		value: 'butin:boucliers',
	}]);
	assert.deepEqual(complete('loot:'), complete('butin:'));
	assert.deepEqual(complete('butin:armes:epee_longue'), [{
		name: 'butin:armes:épée_longue',
		value: 'butin:armes:épée_longue',
	}]);
	assert.deepEqual(
		complete('butin:boucliers:bouclier_en_b'),
		[{
			name: 'butin:boucliers:bouclier_en_bois',
			value: 'butin:boucliers:bouclier_en_bois',
		}],
	);
});

test('localized traversal continues through routes and keeps stable field syntax', () => {
	const result = generatorResolver.generate(
		'butin:boucliers:bouclier_en_bois.ar_percentage',
		'fr',
		{ random: () => 0 },
	);
	assert.equal(result.generatorId, 'shields');
	assert.equal(result.entryId, 'wooden_shield');
	assert.deepEqual(result.fields, { ar_percentage: 5 });
	assert.deepEqual(
		generatorResolver.generate(
			'butin:boucliers:bouclier_en_bois.name',
			'fr',
			{ random: () => 0 },
		).fields,
		{ name: 'Bouclier en bois' },
	);
	assert.equal(
		generatorResolver.generate(
			'loot:shields.generator:wooden_shield.name',
			'fr',
			{ random: () => 0 },
		).entryId,
		'wooden_shield',
	);
	assert.deepEqual(
		generatorResolver.generate(
			'loot:shields:wooden_shield.name',
			'en',
			{ random: () => 0 },
		).fields,
		{ name: 'Wooden shield' },
	);
	const aliasedWeapon = generatorResolver.generate(
		'loot:weapons:long_sword.description',
		'en',
		{ random: () => 0 },
	);
	const stableWeapon = generatorResolver.generate(
		'loot:weapons:longsword.description',
		'en',
		{ random: () => 0 },
	);
	assert.equal(aliasedWeapon.entryId, 'longsword');
	assert.deepEqual(aliasedWeapon.fields, stableWeapon.fields);
	assert.equal(
		generatorResolver.generate(
			'background:criminal.name',
			'en',
			{ random: () => 0 },
		).generatorId,
		'criminal',
	);
});

test('generator autocomplete searches beyond the first 25 localized entries', () => {
	const complete = value => AUTOCOMPLETE_PROVIDERS['generator-paths'](
		{},
		{ locale: 'fr' },
		{ value },
	);
	const initial = complete('butin:armes:');
	assert.equal(initial.length, 25);
	assert.ok(!initial.some(choice => choice.value.endsWith(':épée_runique')));
	assert.deepEqual(complete('butin:armes:epee_runique'), [{
		name: 'butin:armes:épée_runique',
		value: 'butin:armes:épée_runique',
	}]);
	assert.equal(
		generatorResolver.generate(
			'butin:armes:épée_runique',
			'fr',
			{ random: () => 0 },
		).entryId,
		'runed_sword',
	);
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
		defaultProfile.minimums[stat] === 4
		&& defaultProfile.maximums[stat] === 20
		&& defaultProfile.weights[stat] === 1
	)));
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

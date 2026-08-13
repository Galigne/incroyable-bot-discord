const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, afterEach, test } = require('node:test');

const testSaveDirectory = fs.mkdtempSync(
	path.join(os.tmpdir(), 'incredible-bot-creature-generation-'),
);
process.env.INCREDIBLE_BOT_SAVE_DIRECTORY = testSaveDirectory;

const Creature = require('../models/Creature');
const commandRegistry = require('../commands/registry');
const { loadConfig } = require('../util/configuration');

const config = loadConfig();
const {
	generateCreature,
} = require('../services/creatureApplicationService');
const {
	getEntityOperationQueueSize,
} = require('../services/entityOperationQueue');
const { createCharacter } = require('../services/characterStore');
const {
	getCreatureHistoryPath,
	getCreatureSavePath,
} = require('../services/entityStoragePaths');
const { getCreature } = require('../services/creatureStore');
const { reloadGenerationData } = require('../services/generationData');
const generatorCatalog = require('../services/generatorCatalog');
const {
	createGeneratorCatalogCandidate,
} = require('../services/generatorCatalog');
const generatorResolver = require('../services/generatorResolver');
const {
	CREATURE_ROUTER_ID,
	validateCreatureStatProfileRelationships,
	validateGeneratorDefinition,
	validateGeneratorPair,
	validateGeneratorRelationships,
} = require('../services/generatorSchema');
const {
	calculateStatBudget,
	calculateStatCost,
} = require('../services/mechanics/characterGeneration');
const {
	parseWrappedInlineReference,
} = require('../services/generatorSchema/referenceValidation');
const { BASE_STATS } = require('../services/mechanics/constants');
const { calculateArmorRating } = require('../services/mechanics/armor');
const {
	createGeneratedResources,
} = require('../services/mechanics/resources');
const {
	populateRandomCreature,
} = require('../services/randomCreatureGenerator');
const { getStatProfile } = require('../services/statProfileCatalog');
const {
	createStatProfileCandidate,
} = require('../services/statProfileCatalog');
const { authorizeCommand } = require('../util/authorization');
const {
	createCreatureFieldEmbed,
	createCreatureSummaryEmbed,
} = require('../util/creatureRenderer');

afterEach(() => {
	for (const entry of fs.readdirSync(testSaveDirectory)) {
		fs.rmSync(path.join(testSaveDirectory, entry), {
			force: true,
			recursive: true,
		});
	}
});

after(() => {
	fs.rmSync(testSaveDirectory, { recursive: true, force: true });
});

test('production creature sources are strict localized types backed by profiles', () => {
	const creatureTypes = getCreatureTypes();
	const profileIds = new Set();
	for (const locale of ['en', 'fr']) {
		const router = generatorCatalog.getGenerator(CREATURE_ROUTER_ID, locale);
		assert.equal(router.visibility, 'public');
		assert.deepEqual(router.entries.map(entry => entry.id), creatureTypes);
		for (const type of creatureTypes) {
			const generatorId = getCreatureGeneratorId(type, locale);
			assert.equal(
				router.entries.find(entry => entry.id === type).fields.generator,
				`{{ ${generatorId} }}`,
			);
			const generator = generatorCatalog.getGenerator(generatorId, locale);
			assert.equal(generator.visibility, 'internal');
			assert.deepEqual(generator.entrySchema, {
				type: 'fields',
				required: ['name', 'description'],
			});
			assert.ok(generator.entries.length > 0);
			for (const entry of generator.entries) {
				assert.ok(Number.isFinite(entry.weight) && entry.weight > 0);
				assert.deepEqual(Object.keys(entry.fields), ['name', 'description']);
				assert.ok(entry.fields.name);
				assert.ok(entry.fields.description);
				assert.ok(entry.generation.traits.length > 0);
				assert.ok(Array.isArray(entry.generation.equipment));
				assert.ok(Array.isArray(entry.generation.inventory));
				for (const forbidden of [
					'statistics',
					'resources',
					'encumbrance',
					'entityType',
				]) {
					assert.equal(Object.hasOwn(entry.generation, forbidden), false);
				}
				assert.ok(getStatProfile(entry.generation.statProfile));
				profileIds.add(entry.generation.statProfile);
			}
		}
	}
	assert.ok(profileIds.size > 0);

	for (const generatorId of ['modifier_character', 'modifier_creature']) {
		const modifier = generatorCatalog.getGenerator(generatorId, 'en');
		assert.equal(modifier.visibility, 'internal');
		assert.ok(modifier.entries.every(entry => (
			JSON.stringify(Object.keys(entry.fields)) === JSON.stringify([
				'name',
				'description',
			])
		)));
	}
});

test('creature metadata rejects mechanical overrides and armor conflicts', () => {
	const { generatorId } = getCreatureFixture();
	const english = structuredClone(generatorCatalog.getGenerator(generatorId, 'en'));
	delete english.locale;

	const mechanical = structuredClone(english);
	mechanical.entries[0].generation.statistics = { constitution: 20 };
	assert.throws(
		() => validateGeneratorDefinition(mechanical),
		error => error.code === 'INVALID_GENERATOR_STRUCTURE',
	);

	const armorConflict = structuredClone(english);
	armorConflict.entries[0].generation.armor = {
		generator: 'armors',
		entry: 'common_light_armor',
		select: 'fields',
	};
	assert.throws(
		() => validateGeneratorDefinition(armorConflict),
		error => error.code === 'CREATURE_ARMOR_SOURCE_CONFLICT',
	);
});

test('creature metadata preserves English and French technical parity', () => {
	const { generatorId } = getCreatureFixture();
	const english = structuredClone(generatorCatalog.getGenerator(generatorId, 'en'));
	const french = structuredClone(generatorCatalog.getGenerator(generatorId, 'fr'));
	delete english.locale;
	delete french.locale;
	const originalProfile = english.entries[0].generation.statProfile;
	french.entries[0].generation.statProfile = [...createStatProfileCandidate().keys()]
		.find(profileId => profileId !== originalProfile);
	assert.throws(
		() => validateGeneratorPair(english, french),
		error => error.code === 'GENERATOR_LOCALE_PARITY_MISMATCH',
	);
});

test('creature routers, types, and statistical profiles validate relationships', () => {
	const catalogs = createGeneratorCatalogCandidate();
	const profiles = createStatProfileCandidate();
	const firstCreatureType = getCreatureTypes()[0];
	const firstCreatureGeneratorId = getCreatureGeneratorId(firstCreatureType);
	const profileToRemove = catalogs.get('en').get(firstCreatureGeneratorId)
		.entries[0].generation.statProfile;
	profiles.delete(profileToRemove);
	assert.throws(
		() => validateCreatureStatProfileRelationships(catalogs, profiles),
		error => error.code === 'CREATURE_STAT_PROFILE_MISSING',
	);
	const missingRouterCatalogs = createGeneratorCatalogCandidate();
	missingRouterCatalogs.get('en').delete('creature');
	assert.throws(
		() => validateCreatureStatProfileRelationships(
			missingRouterCatalogs,
			createStatProfileCandidate(),
		),
		error => error.code === 'CREATURE_ROUTER_MISSING',
	);
	const missingArchetypeCatalogs = createGeneratorCatalogCandidate();
	missingArchetypeCatalogs.get('fr').delete(getCreatureFixture().generatorId);
	assert.throws(
		() => validateCreatureStatProfileRelationships(
			missingArchetypeCatalogs,
			createStatProfileCandidate(),
		),
		error => error.code === 'CREATURE_ARCHETYPE_MISSING',
	);
	const invalidRoutes = createGeneratorCatalogCandidate();
	const { generatorId } = getCreatureFixture();
	const invalidRouter = structuredClone(invalidRoutes.get('fr').get('creature'));
	invalidRouter.entries[0].fields.generator = `{{ ${generatorId}.name }}`;
	invalidRoutes.get('fr').set('creature', invalidRouter);
	assert.throws(
		() => validateCreatureStatProfileRelationships(
			invalidRoutes,
			createStatProfileCandidate(),
		),
		error => error.code === 'CREATURE_ROUTE_INVALID',
	);
});

test('creature generation references require compatible target payloads', () => {
	const catalog = new Map(createGeneratorCatalogCandidate().get('en'));
	const { generatorId } = getCreatureFixture();
	const detail = structuredClone(catalog.get(generatorId));
	detail.entries[0].generation.statusEffects = [{
		generator: 'faction',
		select: 'fields',
	}];
	catalog.set(generatorId, detail);
	assert.throws(
		() => validateGeneratorRelationships(catalog),
		error => error.code === 'INVALID_CREATURE_REFERENCE_TARGET',
	);
});

test('equivalent random input selects the same stable IDs and statistics in both locales', () => {
	for (const type of getCreatureTypes()) {
		const english = populateRandomCreature(
			new Creature(`Deterministic.${type}.en`, 'creator'),
			{ type, level: 6, locale: 'en', random: () => 0 },
		);
		const french = populateRandomCreature(
			new Creature(`Deterministic.${type}.fr`, 'creator'),
			{ type, level: 6, locale: 'fr', random: () => 0 },
		);

		assert.equal(english.source.entryId, french.source.entryId);
		assert.equal(english.source.statProfileId, french.source.statProfileId);
		assert.deepEqual(english.source.provenance, french.source.provenance);
		assert.deepEqual(english.statistics, french.statistics);
		assert.deepEqual(english.resources.hp, french.resources.hp);
		assert.deepEqual(english.resources.ar, french.resources.ar);
		assert.deepEqual(
			english.traits.map(trait => trait.id),
			french.traits.map(trait => trait.id),
		);
		assert.deepEqual(
			english.status.modifiers.map(modifier => modifier.entryId),
			french.status.modifiers.map(modifier => modifier.entryId),
		);
	}
});

test('all creature profiles use the shared nonlinear level budget and derived resources', () => {
	const representatives = getCreatureRepresentatives();
	const usedProfiles = new Set();
	for (const [type, entryId] of representatives) {
		const creature = generateEntry(type, entryId, { level: 8 });
		const profile = getStatProfile(creature.source.statProfileId);
		usedProfiles.add(profile.id);
		for (const stat of BASE_STATS) {
			assert.ok(creature.statistics[stat] >= profile.minimums[stat], stat);
			assert.ok(creature.statistics[stat] <= profile.maximums[stat], stat);
		}
		assert.ok(
			calculateStatCost(creature.statistics) <= calculateStatBudget(creature.level),
		);
		assert.equal(creature.statistics.initiative, creature.statistics.speed);
		assert.equal(creature.statistics.reflexes, creature.statistics.speed);
		assert.deepEqual(
			{
				hp: creature.resources.hp,
				ar: creature.resources.ar,
				ap: creature.resources.ap,
				md: creature.resources.md,
			},
			createGeneratedResources(
				creature.statistics,
				creature.level,
				getArmorPercentage(creature),
			),
		);
	}
	assert.deepEqual(usedProfiles, new Set(
		representatives.map(([type, entryId]) => (
			generatorCatalog.getGenerator(
				getCreatureGeneratorId(type),
				'en',
			).entries.find(entry => entry.id === entryId).generation.statProfile
		)),
	));
	const [type, entryId] = representatives[0];
	for (let level = 1; level <= 10; level += 1) {
		const creature = generateEntry(type, entryId, { level });
		assert.equal(creature.level, level);
		assert.ok(
			calculateStatCost(creature.statistics) <= calculateStatBudget(level),
		);
		assert.equal(creature.resources.hp.current, creature.resources.hp.max);
		assert.equal(creature.resources.ap.current, creature.resources.ap.max);
	}

	const randomLevel = populateRandomCreature(
		new Creature('Random.Level', 'creator'),
		{
			type,
			random: sequenceRandom([0.999999, 0, 0.99]),
		},
	);
	assert.equal(randomLevel.level, 10);
});

test('creature Intelligence never grants RULEs and explicit RULE references are preserved', () => {
	const intelligentMule = generateEntry(getCreatureTypeForEntry('mule'), 'mule', {
		level: 10,
		randomFallback: 0.4,
	});
	assert.ok(intelligentMule.statistics.intelligence >= 16);
	assert.deepEqual(intelligentMule.rules, []);

	const mireTroll = generateEntry(
		getCreatureTypeForEntry('mire_troll'),
		'mire_troll',
		{ level: 10 },
	);
	assert.ok(mireTroll.statistics.intelligence <= 8);
	assert.deepEqual(mireTroll.rules.map(rule => ({
		entryId: rule.entryId,
		level: rule.level,
	})), [{ entryId: 'root_rule', level: 1 }]);
	assert.ok(mireTroll.rules[0].name);
	assert.ok(mireTroll.rules[0].description);
});

test('natural armor, generated armor, status, and weighted gear resolve to final state', () => {
	const cinderDrake = generateEntry(
		getCreatureTypeForEntry('cinder_drake'),
		'cinder_drake',
		{ level: 5 },
	);
	assert.deepEqual(cinderDrake.naturalArmor, { percentage: 15 });
	assert.equal(
		cinderDrake.resources.ar.max,
		calculateArmorRating(cinderDrake.resources.hp.max, 15),
	);
	assert.deepEqual(
		cinderDrake.status.modifiers.map(modifier => [modifier.generatorId, modifier.entryId]),
		[['modifier_creature', 'smoldering']],
	);
	assert.ok(cinderDrake.status.modifiers[0].provenance.length > 0);

	const bellWraith = generateEntry(
		getCreatureTypeForEntry('bell_wraith'),
		'bell_wraith',
		{ level: 5 },
	);
	const armorEntry = generatorCatalog.getGenerator('armors', 'en').entries
		.find(entry => entry.id === 'common_heavy_armor');
	assert.deepEqual(bellWraith.naturalArmor, { percentage: 0 });
	assert.equal(
		bellWraith.resources.ar.max,
		calculateArmorRating(
			bellWraith.resources.hp.max,
			armorEntry.fields['ar_percentage'],
		),
	);
	assert.equal(bellWraith.gear.equipment.length, 2);
	assert.ok(bellWraith.source.provenance.some(record => (
		record.generatorId === 'armors'
		&& record.entryId === 'common_heavy_armor'
	)));

	const mule = generateEntry(getCreatureTypeForEntry('mule'), 'mule', { level: 5 });
	assert.equal(mule.gear.inventory.length, 1);
	assert.ok(mule.source.provenance.some(record => (
		record.type === 'generator-source'
		&& record.selection === 'weighted'
		&& record.generatorId === 'inventory'
	)));
	for (const creature of [cinderDrake, bellWraith, mule]) {
		assert.deepEqual(creature.gear.encumbrance, { current: 0, max: 0 });
	}
});

test('descriptive modifiers cannot change mechanical generation results', () => {
	const { type, generatorId } = getCreatureFixture();
	const baseResult = generatorResolver.resolveReference(
		{ generator: generatorId, select: 'fields' },
		'en',
		{ random: () => 0 },
	);
	const withoutModifier = structuredClone(baseResult);
	withoutModifier.modifiers = [];
	const modifierResult = {
		fields: {
			name: 'Scarred',
			description: 'Old scars remain visible.',
		},
		provenance: [{
			type: 'entry',
			selection: 'random',
			generatorId: 'modifier_creature',
			entryId: 'scarred',
			path: 'root.creature.modifier',
		}],
	};

	const plain = populateRandomCreature(
		new Creature('Modifier.Plain', 'creator'),
		{
			type,
			level: 7,
			random: () => 0,
			resolver: createDetailResolver(generatorId, withoutModifier),
		},
	);
	const modified = populateRandomCreature(
		new Creature('Modifier.Applied', 'creator'),
		{
			type,
			level: 7,
			random: () => 0,
			resolver: createDetailResolver(
				generatorId,
				withoutModifier,
				modifierResult,
			),
		},
	);
	assert.equal(modified.status.modifiers.length, 1);
	for (const property of [
		'level',
		'naturalArmor',
		'statistics',
		'resources',
		'traits',
		'rules',
		'gear',
	]) {
		assert.deepEqual(modified[property], plain[property], property);
	}
	assert.deepEqual(modified.status.effects, plain.status.effects);
	assert.ok(modified.status.modifiers.every(modifier => (
		Object.keys(modifier).toSorted().join(',')
		=== 'description,entryId,generatorId,name,provenance'
	)));
});

test('/gen-creature is DM-only and atomically persists a complete generated creature', async () => {
	const metadata = commandRegistry.getCommand('gen-creature');
	const generatedType = getCreatureTypes()[0];
	assert.equal(metadata.permission, 'dm');
	assert.equal(metadata.help.order, 22);
	assert.equal(metadata.options.find(option => option.name === 'type').required, undefined);
	assert.equal(metadata.options.find(option => option.name === 'level').required, undefined);

	const owner = createInteraction('server-owner', [], 'server-owner');
	const dm = createInteraction('dm-user', [config.roles.dm]);
	const regular = createInteraction('regular-user');
	assert.equal(authorizeCommand(metadata, owner, config).allowed, true);
	assert.equal(authorizeCommand(metadata, dm, config).allowed, true);
	assert.equal(authorizeCommand(metadata, regular, config).allowed, false);

	let response;
	const interaction = {
		...dm,
		guildId: 'guild',
		options: {
			getInteger: option => option === 'level' ? 4 : null,
			getString: option => ({
				'creature-key': 'Command.Generated',
				type: generatedType,
			})[option],
		},
		reply: async payload => {
			response = payload;
		},
	};
	await commandRegistry.getRuntimeCommands().get('gen-creature').execute({
		config,
		interaction,
	});
	const stored = await getCreature('Command.Generated');
	assert.equal(stored.level, 4);
	assert.equal(stored.source.archetypeId, generatedType);
	assert.match(response.content, /Command\.Generated/);
	assert.equal(response.embeds[0].toJSON().title, stored.displayName);
	const typeName = getCreatureRoute(generatedType, 'en').fields.name;
	assert.ok(createCreatureFieldEmbed(stored, 'identity', 'en').toJSON().fields
		.some(field => (
			field.name === 'Archetype'
			&& field.value === typeName[0].toLocaleUpperCase('en')
				+ typeName.slice(1)
		)));
	assert.equal(await pathExists(getCreatureHistoryPath(stored.key)), false);
	assert.equal(getEntityOperationQueueSize(), 0);
});

test('/gen-creature type autocomplete uses localized router entries and stable IDs', async () => {
	const typeId = getCreatureTypes()[0];
	const localizedRoute = getCreatureRoute(typeId, 'fr');
	const focusedValue = typeId.slice(0, 3);
	let choices;
	await commandRegistry.getRuntimeCommands().get('gen-creature').autocomplete({
		config: { ...config, locale: 'fr' },
		interaction: {
			guild: { ownerId: 'server-owner' },
			guildId: 'guild',
			member: { roles: { cache: { has: () => true } } },
			options: {
				getFocused: () => ({ name: 'type', value: focusedValue }),
			},
			respond: async value => {
				choices = value;
			},
			user: { id: 'dm-user' },
		},
	});
	const choice = choices.find(candidate => candidate.value === typeId);
	assert.ok(choice);
	assert.equal(
		choice.name,
		`${localizedRoute.fields.name} — ${localizedRoute.fields.description}`.slice(0, 100),
	);
});

test('/gen-creature treats an omitted Discord type option as random selection', async () => {
	const dm = createInteraction('dm-user', [config.roles.dm]);
	let response;
	const interaction = {
		...dm,
		options: {
			getInteger: () => null,
			getString: option => option === 'creature-key'
				? 'Command.Random'
				: null,
		},
		reply: async payload => {
			response = payload;
		},
	};

	await commandRegistry.getRuntimeCommands().get('gen-creature').execute({
		config,
		interaction,
	});

	const stored = await getCreature('Command.Random');
	assert.ok(getCreatureTypes().includes(stored.source.archetypeId));
	assert.match(response.content, /Command\.Random/);
});

test('/gen-creature randomly selects a router entry when type is omitted', () => {
	const creature = populateRandomCreature(
		new Creature('Random.Type', 'creator'),
		{
			level: 4,
			locale: 'en',
			random: sequenceRandom([0.999999, 0]),
		},
	);
	const expectedType = getCreatureTypes().at(-1);
	assert.equal(creature.source.archetypeId, expectedType);
	assert.equal(creature.source.generatorId, getCreatureGeneratorId(expectedType));
});

test('generation, collision, and save failures leave no partial creature or history', async () => {
	const validType = getCreatureTypes()[0];
	for (const [entityKey, options] of [
		['Validation.Type', { type: 'dragon', level: 1 }],
		['Validation.Level', { type: validType, level: 11 }],
	]) {
		await assert.rejects(
			generateCreature(entityKey, 'creator', options),
			{ code: 'INVALID_RANDOM_CREATURE' },
		);
		assert.equal(await pathExists(getCreatureSavePath(entityKey)), false);
		assert.equal(await pathExists(getCreatureHistoryPath(entityKey)), false);
	}

	await createCharacter('Collision.Key', 'creator');
	await assert.rejects(
		generateCreature('Collision.Key', 'creator', {
			type: validType,
			level: 1,
			random: () => 0,
		}),
		{ code: 'EEXIST' },
	);
	assert.equal(await pathExists(getCreatureSavePath('Collision.Key')), false);
	assert.equal(await pathExists(getCreatureHistoryPath('Collision.Key')), false);

	await assert.rejects(
		generateCreature('Generation.Failure', 'creator', {
			type: validType,
			level: 1,
			resolver: {
				resolveReference() {
					throw Object.assign(new Error('injected generation failure'), {
						code: 'INJECTED_GENERATION_FAILURE',
					});
				},
				resolveInlineReference() {
					throw Object.assign(new Error('injected generation failure'), {
						code: 'INJECTED_GENERATION_FAILURE',
					});
				},
			},
		}),
		{ code: 'INJECTED_GENERATION_FAILURE' },
	);
	assert.equal(await pathExists(getCreatureSavePath('Generation.Failure')), false);
	assert.equal(await pathExists(getCreatureHistoryPath('Generation.Failure')), false);

	const originalLink = fsPromises.link;
	fsPromises.link = async () => {
		throw Object.assign(new Error('injected publication failure'), {
			code: 'EIO',
		});
	};
	try {
		await assert.rejects(
			generateCreature('Save.Failure', 'creator', {
				type: validType,
				level: 1,
				random: () => 0,
			}),
			{ code: 'EIO' },
		);
	}
	finally {
		fsPromises.link = originalLink;
	}
	assert.equal(await pathExists(getCreatureSavePath('Save.Failure')), false);
	assert.equal(await pathExists(getCreatureHistoryPath('Save.Failure')), false);
	const creatureDirectory = path.dirname(getCreatureSavePath('Save.Failure'));
	assert.ok((await fsPromises.readdir(creatureDirectory)).every(name => (
		!name.includes('Save.Failure')
	)));

	const concurrent = await Promise.allSettled([
		generateCreature('Concurrent.Key', 'creator-a', {
			type: validType,
			level: 2,
			random: () => 0,
		}),
		generateCreature('Concurrent.Key', 'creator-b', {
			type: validType,
			level: 3,
			random: () => 0,
		}),
	]);
	assert.equal(concurrent.filter(result => result.status === 'fulfilled').length, 1);
	assert.deepEqual(
		concurrent.filter(result => result.status === 'rejected')
			.map(result => result.reason.code),
		['EEXIST'],
	);
	assert.equal((await getCreature('Concurrent.Key')).key, 'Concurrent.Key');
	assert.equal(await pathExists(getCreatureHistoryPath('Concurrent.Key')), false);
	assert.equal(getEntityOperationQueueSize(), 0);
});

test('loading and rendering persisted creatures never reruns generation after reload', async () => {
	const validType = getCreatureTypes().at(-1);
	const generated = await generateCreature('Reload.Stable', 'creator', {
		type: validType,
		level: 6,
		locale: 'fr',
		random: () => 0,
	});
	const savedBefore = await fsPromises.readFile(
		getCreatureSavePath(generated.key),
		'utf8',
	);
	assert.ok(generated.source.provenance.length > 0);
	assert.ok(generated.status.modifiers[0].provenance.length > 0);
	reloadGenerationData();

	const originalRandom = Math.random;
	Math.random = () => {
		throw new Error('Generation must not rerun while loading or rendering.');
	};
	let loaded;
	try {
		loaded = await getCreature(generated.key);
		createCreatureSummaryEmbed(loaded, 'fr').toJSON();
		createCreatureFieldEmbed(loaded, 'identity', 'fr').toJSON();
	}
	finally {
		Math.random = originalRandom;
	}
	assert.deepEqual(loaded.source, generated.source);
	assert.deepEqual(loaded.status, generated.status);
	assert.deepEqual(loaded.status.modifiers, generated.status.modifiers);
	assert.equal(
		await fsPromises.readFile(getCreatureSavePath(generated.key), 'utf8'),
		savedBefore,
	);
});

function generateEntry(type, entryId, {
	level,
	randomFallback = 0.5,
} = {}) {
	return populateRandomCreature(
		new Creature(`Generated.${type}.${entryId}`, 'creator'),
		{
			type,
			level,
			locale: 'en',
			random: sequenceRandom([
				getEntryMidpoint(type, entryId),
				0.99,
			], randomFallback),
		},
	);
}

function getEntryMidpoint(generatorId, entryId) {
	const detailGeneratorId = getCreatureGeneratorId(generatorId) ?? generatorId;
	const entries = generatorCatalog.getGenerator(detailGeneratorId, 'en').entries;
	const totalWeight = entries.reduce((total, entry) => total + entry.weight, 0);
	let previousWeight = 0;
	for (const entry of entries) {
		if (entry.id === entryId) {
			return (previousWeight + entry.weight / 2) / totalWeight;
		}
		previousWeight += entry.weight;
	}
	throw new Error(`Unknown ${generatorId} entry ${entryId}.`);
}

function getCreatureTypes(locale = 'en') {
	return generatorCatalog.getGenerator(CREATURE_ROUTER_ID, locale)
		.entries.map(entry => entry.id);
}

function getCreatureRoute(typeId, locale = 'en') {
	return generatorCatalog.getGenerator(CREATURE_ROUTER_ID, locale)
		.entries.find(entry => entry.id === typeId);
}

function getCreatureGeneratorId(typeId, locale = 'en') {
	const route = getCreatureRoute(typeId, locale);
	try {
		const reference = parseWrappedInlineReference(
			route?.fields?.generator,
			'creature route test',
		);
		return reference.entry || reference.field ? undefined : reference.generator;
	}
	catch {
		return undefined;
	}
}

function getCreatureFixture(locale = 'en') {
	const type = getCreatureTypes(locale)[0];
	return {
		type,
		generatorId: getCreatureGeneratorId(type, locale),
	};
}

function getCreatureRepresentatives(locale = 'en') {
	const representatives = [];
	const profileIds = new Set();
	for (const type of getCreatureTypes(locale)) {
		const generatorId = getCreatureGeneratorId(type, locale);
		const generator = generatorCatalog.getGenerator(generatorId, locale);
		for (const entry of generator.entries) {
			const profileId = entry.generation.statProfile;
			if (!profileIds.has(profileId)) {
				profileIds.add(profileId);
				representatives.push([type, entry.id]);
			}
		}
	}
	return representatives;
}

function getCreatureTypeForEntry(entryId, locale = 'en') {
	return getCreatureTypes(locale).find(type => {
		const generatorId = getCreatureGeneratorId(type, locale);
		return generatorCatalog.getGenerator(generatorId, locale).entries
			.some(entry => entry.id === entryId);
	});
}

function sequenceRandom(values, fallback = 0.5) {
	const remaining = [...values];
	return () => remaining.length > 0 ? remaining.shift() : fallback;
}

function getArmorPercentage(creature) {
	if (creature.naturalArmor.percentage > 0) {
		return creature.naturalArmor.percentage;
	}
	const armorSelection = creature.source.provenance.find(record => (
		record.generatorId === 'armors'
	));
	if (!armorSelection) {
		return 0;
	}
	return generatorCatalog.getGenerator('armors', 'en').entries
		.find(entry => entry.id === armorSelection.entryId)
		.fields['ar_percentage'];
}

function createDetailResolver(generatorId, result, modifierResult) {
	return {
		resolveReference(reference, locale, options) {
			if (reference.generator === generatorId && !reference.entry) {
				return structuredClone(result);
			}
			if (reference.generator === 'modifier_creature' && modifierResult) {
				return structuredClone(modifierResult);
			}
			return generatorResolver.resolveReference(reference, locale, options);
		},
		resolveInlineReference(expression, locale, options) {
			const reference = parseWrappedInlineReference(expression, 'creature detail test');
			if (reference.generator === generatorId && !reference.entry && !reference.field) {
				return structuredClone(result);
			}
			return generatorResolver.resolveInlineReference(expression, locale, options);
		},
	};
}

function createInteraction(userId, roleIds = [], ownerId = 'server-owner') {
	return {
		guild: { ownerId },
		guildId: 'guild',
		member: {
			roles: {
				cache: { has: roleId => roleIds.includes(roleId) },
			},
		},
		user: { id: userId },
	};
}

async function pathExists(filePath) {
	try {
		await fsPromises.access(filePath);
		return true;
	}
	catch (error) {
		if (error.code === 'ENOENT') {
			return false;
		}
		throw error;
	}
}

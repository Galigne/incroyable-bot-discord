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
const config = require('../config.json');
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
	CREATURE_ARCHETYPE_IDS,
	CREATURE_GENERATOR_BY_ARCHETYPE,
	CREATURE_ROUTER_ID,
	validateCreatureStatProfileRelationships,
	validateGeneratorDefinition,
	validateGeneratorPair,
} = require('../services/generatorSchema');
const {
	calculateStatBudget,
	calculateStatCost,
} = require('../services/mechanics/characterGeneration');
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

test('production creature sources are strict localized archetypes backed by profiles', () => {
	assert.deepEqual(CREATURE_ARCHETYPE_IDS, ['animal', 'companion', 'monster']);
	const profileIds = new Set();
	for (const locale of ['en', 'fr']) {
		const router = generatorCatalog.getGenerator(CREATURE_ROUTER_ID, locale);
		assert.equal(router.kind, 'category');
		assert.equal(router.visibility, 'public');
		assert.deepEqual(router.entries.map(entry => entry.id), CREATURE_ARCHETYPE_IDS);
		for (const archetype of CREATURE_ARCHETYPE_IDS) {
			const generatorId = CREATURE_GENERATOR_BY_ARCHETYPE[archetype];
			assert.equal(
				router.entries.find(entry => entry.id === archetype).fields.Generator,
				generatorId,
			);
			const generator = generatorCatalog.getGenerator(generatorId, locale);
			assert.equal(generator.kind, 'component');
			assert.equal(generator.visibility, 'internal');
			assert.deepEqual(generator.entrySchema, {
				type: 'fields',
				required: ['Name', 'Description'],
			});
			assert.ok(generator.entries.length >= 20);
			for (const entry of generator.entries) {
				assert.ok(Number.isFinite(entry.weight) && entry.weight > 0);
				assert.deepEqual(Object.keys(entry.fields), ['Name', 'Description']);
				assert.ok(entry.fields.Name);
				assert.ok(entry.fields.Description);
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
	assert.deepEqual(profileIds, new Set([
		'creature-brute',
		'creature-caster',
		'creature-companion',
		'creature-elemental',
		'creature-predator',
	]));

	const modifier = generatorCatalog.getGenerator('modifier', 'en');
	assert.equal(modifier.kind, 'modifier');
	assert.deepEqual(modifier.appliesTo, [
		'background',
		...Object.values(CREATURE_GENERATOR_BY_ARCHETYPE),
	]);
	assert.ok(modifier.entries.every(entry => (
		JSON.stringify(Object.keys(entry.fields)) === JSON.stringify([
			'Name',
			'Description',
		])
	)));
});

test('creature schema rejects mechanical overrides, armor conflicts, parity drift, and missing profiles', () => {
	const english = structuredClone(generatorCatalog.getGenerator('creature-animal', 'en'));
	const french = structuredClone(generatorCatalog.getGenerator('creature-animal', 'fr'));
	delete english.locale;
	delete french.locale;

	const mechanical = structuredClone(english);
	mechanical.entries[0].generation.statistics = { constitution: 20 };
	assert.throws(
		() => validateGeneratorDefinition(mechanical),
		error => error.code === 'INVALID_GENERATOR_STRUCTURE',
	);

	const armorConflict = structuredClone(english);
	armorConflict.entries[0].generation.armor = {
		generator: 'armors',
		entry: 'common-light-armor',
		select: 'fields',
	};
	assert.throws(
		() => validateGeneratorDefinition(armorConflict),
		error => error.code === 'CREATURE_ARMOR_SOURCE_CONFLICT',
	);

	french.entries[0].generation.statProfile = 'creature-brute';
	assert.throws(
		() => validateGeneratorPair(english, french),
		error => error.code === 'GENERATOR_LOCALE_PARITY_MISMATCH',
	);

	const catalogs = createGeneratorCatalogCandidate();
	const profiles = createStatProfileCandidate();
	profiles.delete('creature-predator');
	assert.throws(
		() => validateCreatureStatProfileRelationships(catalogs, profiles),
		error => error.code === 'CREATURE_STAT_PROFILE_MISSING',
	);
	const missingArchetypeCatalogs = createGeneratorCatalogCandidate();
	missingArchetypeCatalogs.get('fr').delete('creature-animal');
	assert.throws(
		() => validateCreatureStatProfileRelationships(
			missingArchetypeCatalogs,
			createStatProfileCandidate(),
		),
		error => error.code === 'CREATURE_ARCHETYPE_MISSING',
	);
	const invalidRoutes = createGeneratorCatalogCandidate();
	const invalidRouter = structuredClone(invalidRoutes.get('fr').get('creature'));
	invalidRouter.entries[0].fields.Generator = 'creature-monster';
	invalidRoutes.get('fr').set('creature', invalidRouter);
	assert.throws(
		() => validateCreatureStatProfileRelationships(
			invalidRoutes,
			createStatProfileCandidate(),
		),
		error => error.code === 'CREATURE_ROUTE_INVALID',
	);
});

test('equivalent random input selects the same stable IDs and statistics in both locales', () => {
	for (const archetype of CREATURE_ARCHETYPE_IDS) {
		const english = populateRandomCreature(
			new Creature(`Deterministic.${archetype}.en`, 'creator'),
			{ archetype, level: 6, locale: 'en', random: () => 0 },
		);
		const french = populateRandomCreature(
			new Creature(`Deterministic.${archetype}.fr`, 'creator'),
			{ archetype, level: 6, locale: 'fr', random: () => 0 },
		);

		assert.equal(english.source.entryId, french.source.entryId);
		assert.equal(english.source.statProfileId, french.source.statProfileId);
		assert.deepEqual(english.source.provenance, french.source.provenance);
		assert.deepEqual(english.statistics, french.statistics);
		assert.deepEqual(english.status.hp, french.status.hp);
		assert.deepEqual(english.status.ar, french.status.ar);
		assert.deepEqual(
			english.traits.map(trait => trait.id),
			french.traits.map(trait => trait.id),
		);
		assert.deepEqual(
			english.modifiers.map(modifier => modifier.entryId),
			french.modifiers.map(modifier => modifier.entryId),
		);
	}
});

test('all creature profiles use the shared nonlinear level budget and derived resources', () => {
	const representatives = [
		['animal', 'mossback-deer'],
		['animal', 'honey-bear'],
		['companion', 'loyal-hound'],
		['companion', 'pebble-elemental'],
		['monster', 'hollow-saint'],
	];
	const usedProfiles = new Set();
	for (const [archetype, entryId] of representatives) {
		const creature = generateEntry(archetype, entryId, { level: 8 });
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
				hp: creature.status.hp,
				ar: creature.status.ar,
				ap: creature.status.ap,
				md: creature.status.md,
			},
			createGeneratedResources(
				creature.statistics,
				creature.level,
				getArmorPercentage(creature),
			),
		);
	}
	assert.equal(usedProfiles.size, 5);
	for (let level = 1; level <= 10; level += 1) {
		const creature = generateEntry('animal', 'mossback-deer', { level });
		assert.equal(creature.level, level);
		assert.ok(
			calculateStatCost(creature.statistics) <= calculateStatBudget(level),
		);
		assert.equal(creature.status.hp.current, creature.status.hp.max);
		assert.equal(creature.status.ap.current, creature.status.ap.max);
	}

	const randomLevel = populateRandomCreature(
		new Creature('Random.Level', 'creator'),
		{
			archetype: 'animal',
			random: sequenceRandom([0.999999, 0, 0.99]),
		},
	);
	assert.equal(randomLevel.level, 10);
});

test('creature Intelligence never grants RULEs and explicit RULE references are preserved', () => {
	const intelligentMule = generateEntry('companion', 'mule', {
		level: 10,
		randomFallback: 0.4,
	});
	assert.ok(intelligentMule.statistics.intelligence >= 16);
	assert.deepEqual(intelligentMule.rules, []);

	const mireTroll = generateEntry('monster', 'mire-troll', { level: 10 });
	assert.ok(mireTroll.statistics.intelligence <= 8);
	assert.deepEqual(mireTroll.rules.map(rule => ({
		entryId: rule.entryId,
		level: rule.level,
	})), [{ entryId: 'root-rule', level: 1 }]);
	assert.ok(mireTroll.rules[0].name);
	assert.ok(mireTroll.rules[0].description);
});

test('natural armor, generated armor, status, and weighted gear resolve to final state', () => {
	const cinderDrake = generateEntry('monster', 'cinder-drake', { level: 5 });
	assert.deepEqual(cinderDrake.naturalArmor, { percentage: 15 });
	assert.equal(
		cinderDrake.status.ar.max,
		calculateArmorRating(cinderDrake.status.hp.max, 15),
	);
	assert.deepEqual(
		cinderDrake.status.effects.map(effect => [effect.generatorId, effect.entryId]),
		[['status-effect', 'smoldering']],
	);
	assert.ok(cinderDrake.status.effects[0].provenance.length > 0);

	const bellWraith = generateEntry('monster', 'bell-wraith', { level: 5 });
	const armorEntry = generatorCatalog.getGenerator('armors', 'en').entries
		.find(entry => entry.id === 'common-heavy-armor');
	assert.deepEqual(bellWraith.naturalArmor, { percentage: 0 });
	assert.equal(
		bellWraith.status.ar.max,
		calculateArmorRating(
			bellWraith.status.hp.max,
			armorEntry.fields['AR percentage'],
		),
	);
	assert.equal(bellWraith.gear.equipment.length, 2);
	assert.ok(bellWraith.source.provenance.some(record => (
		record.generatorId === 'armors'
		&& record.entryId === 'common-heavy-armor'
	)));

	const mule = generateEntry('companion', 'mule', { level: 5 });
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
	const baseResult = generatorResolver.resolveReference(
		{ generator: 'creature-animal', select: 'fields' },
		'en',
		{ random: () => 0 },
	);
	const withoutModifier = structuredClone(baseResult);
	withoutModifier.modifiers = [];
	const withModifier = structuredClone(baseResult);
	assert.equal(withModifier.modifiers.length, 1);

	const plain = populateRandomCreature(
		new Creature('Modifier.Plain', 'creator'),
		{
			archetype: 'animal',
			level: 7,
			random: () => 0.25,
			resolver: createDetailResolver('creature-animal', withoutModifier),
		},
	);
	const modified = populateRandomCreature(
		new Creature('Modifier.Applied', 'creator'),
		{
			archetype: 'animal',
			level: 7,
			random: () => 0.25,
			resolver: createDetailResolver('creature-animal', withModifier),
		},
	);
	assert.equal(modified.modifiers.length, 1);
	for (const property of [
		'level',
		'naturalArmor',
		'statistics',
		'status',
		'traits',
		'rules',
		'gear',
	]) {
		assert.deepEqual(modified[property], plain[property], property);
	}
	assert.ok(modified.modifiers.every(modifier => (
		Object.keys(modifier).toSorted().join(',')
		=== 'description,entryId,generatorId,name,provenance'
	)));
});

test('/gen-monster is DM-only and atomically persists a complete generated creature', async () => {
	const metadata = commandRegistry.getCommand('gen-monster');
	assert.equal(metadata.permission, 'dm');
	assert.equal(metadata.help.order, 22);
	assert.equal(metadata.options.find(option => option.name === 'type').required, true);
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
				type: 'animal',
			})[option],
		},
		reply: async payload => {
			response = payload;
		},
	};
	await commandRegistry.getRuntimeCommands().get('gen-monster').execute({
		config,
		interaction,
	});
	const stored = await getCreature('Command.Generated');
	assert.equal(stored.level, 4);
	assert.equal(stored.source.archetypeId, 'animal');
	assert.match(response.content, /Command\.Generated/);
	assert.equal(response.embeds[0].toJSON().title, stored.displayName);
	assert.ok(createCreatureFieldEmbed(stored, 'identity', 'en').toJSON().fields
		.some(field => field.name === 'Archetype' && field.value === 'Animal'));
	assert.equal(await pathExists(getCreatureHistoryPath(stored.key)), false);
	assert.equal(getEntityOperationQueueSize(), 0);
});

test('generation, collision, and save failures leave no partial creature or history', async () => {
	for (const [entityKey, options] of [
		['Validation.Type', { archetype: 'dragon', level: 1 }],
		['Validation.Level', { archetype: 'animal', level: 11 }],
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
			archetype: 'monster',
			level: 1,
			random: () => 0,
		}),
		{ code: 'EEXIST' },
	);
	assert.equal(await pathExists(getCreatureSavePath('Collision.Key')), false);
	assert.equal(await pathExists(getCreatureHistoryPath('Collision.Key')), false);

	await assert.rejects(
		generateCreature('Generation.Failure', 'creator', {
			archetype: 'animal',
			level: 1,
			resolver: {
				resolveReference() {
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
				archetype: 'companion',
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
			archetype: 'animal',
			level: 2,
			random: () => 0,
		}),
		generateCreature('Concurrent.Key', 'creator-b', {
			archetype: 'monster',
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
	const generated = await generateCreature('Reload.Stable', 'creator', {
		archetype: 'monster',
		level: 6,
		locale: 'fr',
		random: () => 0,
	});
	const savedBefore = await fsPromises.readFile(
		getCreatureSavePath(generated.key),
		'utf8',
	);
	assert.ok(generated.source.provenance.length > 0);
	assert.ok(generated.modifiers[0].provenance.length > 0);
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
	assert.deepEqual(loaded.modifiers, generated.modifiers);
	assert.equal(
		await fsPromises.readFile(getCreatureSavePath(generated.key), 'utf8'),
		savedBefore,
	);
});

function generateEntry(archetype, entryId, {
	level,
	randomFallback = 0.5,
} = {}) {
	return populateRandomCreature(
		new Creature(`Generated.${archetype}.${entryId}`, 'creator'),
		{
			archetype,
			level,
			locale: 'en',
			random: sequenceRandom([
				getEntryMidpoint(archetype, entryId),
				0.99,
			], randomFallback),
		},
	);
}

function getEntryMidpoint(generatorId, entryId) {
	const detailGeneratorId = CREATURE_GENERATOR_BY_ARCHETYPE[generatorId]
		?? generatorId;
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
		.fields['AR percentage'];
}

function createDetailResolver(generatorId, result) {
	return {
		resolveReference(reference, locale, options) {
			return reference.generator === generatorId && !reference.entry
				? structuredClone(result)
				: generatorResolver.resolveReference(reference, locale, options);
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

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
const {
	validateCreatureSaveSchema,
} = require('../services/creatureSaveSchema');
const { reloadGenerationData } = require('../services/generationData');
const generatorCatalog = require('../services/generatorCatalog');
const {
	createGeneratorCatalogCandidate,
} = require('../services/generatorCatalog');
const generatorResolver = require('../services/generatorResolver');
const {
	CREATURE_ROUTER_ID,
	isGeneratorRouter,
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
const {
	createEntityGetResponse,
	createGeneratedCreatureResponse,
} = require('../util/entityCommandResponses');

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
				router.entries.find(entry => entry.id === type).generator,
				generatorId,
			);
			const generator = generatorCatalog.getGenerator(generatorId, locale);
			assert.equal(generator.visibility, 'internal');
			assert.equal(isGeneratorRouter(generator), false);
			assert.deepEqual(generator.entrySchema, {
				required: ['description'],
			});
			assert.ok(generator.entries.length > 0);
			for (const entry of generator.entries) {
				assert.ok(Number.isFinite(entry.weight) && entry.weight > 0);
				assert.deepEqual(Object.keys(entry.fields), ['description']);
				assert.ok(entry.name);
				assert.ok(entry.fields.description);
				assert.ok(Array.isArray(entry.generation.traits));
				assert.ok(entry.generation.traits.length <= 25);
				assert.ok(entry.generation.traits.every(trait => (
					typeof trait === 'string' && trait.trim()
				)));
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
	const traits = generatorCatalog.getGenerator('traits', 'en');
	assert.equal(traits.visibility, 'public');
	assert.deepEqual(traits.entrySchema, {
		required: ['description'],
	});
	assert.ok(traits.entries.every(entry => (
		entry.name && entry.fields.description
	)));

	for (const generatorId of ['modifier_character', 'modifier_creature']) {
		const modifier = generatorCatalog.getGenerator(generatorId, 'en');
		assert.equal(modifier.visibility, 'internal');
		assert.ok(modifier.entries.every(entry => (
			entry.name
			&& JSON.stringify(Object.keys(entry.fields)) === JSON.stringify([
				'description',
			])
		)));
	}
});

test('creature metadata rejects mechanical overrides and armor conflicts', () => {
	const { generatorId } = getCreatureFixture();
	const validationOptions = { creatureGeneratorIds: new Set([generatorId]) };
	const english = structuredClone(generatorCatalog.getGenerator(generatorId, 'en'));
	delete english.locale;

	const mechanical = structuredClone(english);
	mechanical.entries[0].generation.statistics = { constitution: 20 };
	assert.throws(
		() => validateGeneratorDefinition(mechanical, '<generator>', validationOptions),
		error => error.code === 'INVALID_GENERATOR_STRUCTURE',
	);

	const armorConflict = structuredClone(english);
	armorConflict.entries[0].generation.armor = {
		generator: 'armors',
		entry: 'common_light_armor',
		select: 'fields',
	};
	assert.throws(
		() => validateGeneratorDefinition(armorConflict, '<generator>', validationOptions),
		error => error.code === 'CREATURE_ARMOR_SOURCE_CONFLICT',
	);
});

test('creature metadata preserves English and French functional parity', () => {
	const { generatorId } = getCreatureFixture();
	const validationOptions = { creatureGeneratorIds: new Set([generatorId]) };
	const english = structuredClone(generatorCatalog.getGenerator(generatorId, 'en'));
	const french = structuredClone(generatorCatalog.getGenerator(generatorId, 'fr'));
	delete english.locale;
	delete french.locale;
	const originalProfile = english.entries[0].generation.statProfile;
	french.entries[0].generation.statProfile = [...createStatProfileCandidate().keys()]
		.find(profileId => profileId !== originalProfile);
	assert.throws(
		() => validateGeneratorPair(english, french, '<generator>', validationOptions),
		error => error.code === 'GENERATOR_LOCALE_PARITY_MISMATCH',
	);

	french.entries[0].generation.statProfile = originalProfile;
	english.entries[0].generation.traits = ['Sense: {{ traits:keen_smell }}'];
	french.entries[0].generation.traits = ['Sens : {{ traits:keen_hearing }}'];
	assert.throws(
		() => validateGeneratorPair(english, french, '<generator>', validationOptions),
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
	const invalidRouter = structuredClone(invalidRoutes.get('fr').get('creature'));
	delete invalidRouter.entries[0].generator;
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

test('creature trait metadata accepts localized templates and rejects invalid strings', () => {
	const { generatorId } = getCreatureFixture();
	const validationOptions = { creatureGeneratorIds: new Set([generatorId]) };
	const valid = structuredClone(generatorCatalog.getGenerator(generatorId, 'en'));
	delete valid.locale;
	for (const traits of [
		[],
		['Cannot be blinded by ordinary darkness.'],
		['{{ traits:amphibious }}'],
		['{{ traits }}'],
		[
			'Huge — +1 to Strength actions involving pushing or lifting.',
			'Inherited capability: {{ traits:keen_smell }}',
			'{{ traits }}',
		],
	]) {
		const candidate = structuredClone(valid);
		candidate.entries[0].generation.traits = traits;
		assert.doesNotThrow(() => (
			validateGeneratorDefinition(candidate, '<generator>', validationOptions)
		));
	}

	for (const traits of [
		null,
		[{}],
		[''],
		['   '],
		['{{ invalid reference }}'],
	]) {
		const candidate = structuredClone(valid);
		candidate.entries[0].generation.traits = traits;
		assert.throws(() => (
			validateGeneratorDefinition(candidate, '<generator>', validationOptions)
		));
	}
});

test('creature trait references use normal catalog relationship validation', () => {
	for (const [trait, code] of [
		['{{ missing_traits }}', 'GENERATOR_REFERENCE_MISSING'],
		['{{ traits:missing_trait }}', 'GENERATOR_ENTRY_NOT_FOUND'],
		['{{ traits.missing_field }}', 'INVALID_GENERATOR_SELECTOR'],
	]) {
		const catalog = new Map(createGeneratorCatalogCandidate().get('en'));
		const { generatorId } = getCreatureFixture();
		const detail = structuredClone(catalog.get(generatorId));
		detail.entries[0].generation.traits = [trait];
		catalog.set(generatorId, detail);
		assert.throws(
			() => validateGeneratorRelationships(catalog),
			error => error.code === code,
		);
	}
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
		assert.equal(english.traits.length, french.traits.length);
		assert.ok(english.traits.every(trait => typeof trait === 'string'));
		assert.ok(french.traits.every(trait => typeof trait === 'string'));
		assert.deepEqual(
			english.status.modifiers.map(modifier => modifier.entryId),
			french.status.modifiers.map(modifier => modifier.entryId),
		);
	}
});

test('creature generation resolves literal, fixed, random, mixed, and inline traits', () => {
	const animalType = getCreatureTypeForEntry('mossback_deer');
	const traitless = generateEntry(animalType, 'mossback_deer', { level: 3 });
	assert.deepEqual(traitless.traits, []);

	const literal = generateEntry(
		getCreatureTypeForEntry('lantern_finch'),
		'lantern_finch',
		{ level: 3 },
	);
	assert.match(literal.traits[0], /^Luminous Plumage — /);

	const englishFixed = generateLocalizedEntry(animalType, 'river_otter', 'en');
	const frenchFixed = generateLocalizedEntry(animalType, 'river_otter', 'fr');
	assert.deepEqual(englishFixed.traits, [
		generatorResolver.resolveInlineReference(
			'{{ traits:amphibious }}',
			'en',
			{ random: () => 0 },
		).value,
		generatorResolver.resolveInlineReference(
			'{{ traits:aquatic_speed }}',
			'en',
			{ random: () => 0 },
		).value,
	]);
	assert.deepEqual(frenchFixed.traits, [
		generatorResolver.resolveInlineReference(
			'{{ traits:amphibious }}',
			'fr',
			{ random: () => 0 },
		).value,
		generatorResolver.resolveInlineReference(
			'{{ traits:aquatic_speed }}',
			'fr',
			{ random: () => 0 },
		).value,
	]);
	assert.notDeepEqual(englishFixed.traits, frenchFixed.traits);

	const random = generateEntry(getCreatureTypeForEntry('imp'), 'imp', { level: 3 });
	assert.equal(random.traits.length, 2);
	assert.ok(getTraitDisplays('en').has(random.traits[1]));

	const mixed = generateEntry(
		getCreatureTypeForEntry('unstable_chimera'),
		'unstable_chimera',
		{ level: 3 },
	);
	assert.equal(mixed.traits.length, 2);
	assert.match(mixed.traits[0], /^Composite Instinct — .+: .+ — .+/);
	assert.ok(mixed.traits.every(trait => !trait.includes('{{')));
	assert.ok(getTraitDisplays('en').has(mixed.traits[1]));
});

test('every production creature resolves localized traits into valid final state', () => {
	for (const locale of ['en', 'fr']) {
		for (const type of getCreatureTypes(locale)) {
			const generator = generatorCatalog.getGenerator(
				getCreatureGeneratorId(type, locale),
				locale,
			);
			for (const entry of generator.entries) {
				const creature = generateLocalizedEntry(type, entry.id, locale);
				assert.equal(creature.source.entryId, entry.id);
				assert.ok(creature.traits.every(trait => (
					typeof trait === 'string'
					&& trait.trim()
					&& !trait.includes('{{')
				)));
				assert.ok(creature.source.provenance.every(record => (
					record.generatorId !== 'traits'
				)));
				assert.doesNotThrow(() => validateCreatureSaveSchema(creature));
			}
		}
	}
});

test('generated creature saves persist only final trait strings', async () => {
	const type = getCreatureTypeForEntry('river_otter');
	const generated = await generateCreature('Trait.Persistence', 'creator', {
		type,
		level: 4,
		locale: 'en',
		random: sequenceRandom([getEntryMidpoint(type, 'river_otter')], 0),
	});
	const persisted = JSON.parse(await fsPromises.readFile(
		getCreatureSavePath(generated.key),
		'utf8',
	));
	assert.equal(persisted.schemaVersion, 3);
	assert.deepEqual(persisted.traits, generated.traits);
	assert.ok(persisted.traits.every(trait => (
		typeof trait === 'string' && !trait.includes('{{')
	)));
	assert.doesNotMatch(JSON.stringify(persisted.traits), /generatorId|entryId/);
	assert.ok(persisted.source.provenance.every(record => (
		record.generatorId !== 'traits'
	)));
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
		&& record.generatorId === 'supplies'
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
	const followUps = [];
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
		followUp: async payload => followUps.push(payload),
	};
	await commandRegistry.getRuntimeCommands().get('gen-creature').execute({
		config,
		interaction,
	});
	const stored = await getCreature('Command.Generated');
	assert.equal(stored.level, 4);
	assert.equal(stored.source.archetypeId, generatedType);
	assert.match(response.content, /Command\.Generated/);
	assert.deepEqual(
		response.embeds[0].toJSON(),
		createGeneratedCreatureResponse(stored, config.locale).embeds[0].toJSON(),
	);
	const expectedFollowUps = stored.gear.equipment.length > 0
		|| stored.gear.inventory.length > 0
		? [createEntityGetResponse(stored, 'gear', config.locale)]
		: [];
	assert.deepEqual(
		followUps.map(followUp => followUp.embeds[0].toJSON()),
		expectedFollowUps.map(followUp => followUp.embeds[0].toJSON()),
	);
	assert.equal(response.embeds[0].toJSON().title, stored.displayName);
	const typeName = getCreatureRoute(generatedType, 'en').name;
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
	assert.equal(choice.name, localizedRoute.name);
});

test('/gen-creature treats an omitted Discord type option as random selection', async () => {
	const dm = createInteraction('dm-user', [config.roles.dm]);
	let response;
	const followUps = [];
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
		followUp: async payload => followUps.push(payload),
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
				generate() {
					throw Object.assign(new Error('injected generation failure'), {
						code: 'INJECTED_GENERATION_FAILURE',
					});
				},
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
				resolveInlineString() {
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

function generateLocalizedEntry(type, entryId, locale) {
	return populateRandomCreature(
		new Creature(`Generated.${locale}.${type}.${entryId}`, 'creator'),
		{
			type,
			level: 3,
			locale,
			random: sequenceRandom([getEntryMidpoint(type, entryId)], 0.5),
		},
	);
}

function getTraitDisplays(locale) {
	return new Set(generatorCatalog.getGenerator('traits', locale).entries.map(entry => (
		`${entry.name} — ${entry.fields.description}`
	)));
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
	return getCreatureRoute(typeId, locale)?.generator;
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
		generate(traversalPath, locale, options) {
			if (
				traversalPath.startsWith(`${CREATURE_ROUTER_ID}:`)
				&& !traversalPath.includes('.generator')
			) {
				const type = getCreatureTypes(locale).find(candidate => (
					getCreatureGeneratorId(candidate, locale) === generatorId
				));
				const selection = result.provenance.find(record => (
					record.type === 'entry' && record.generatorId === generatorId
				));
				const fields = result.fields ?? result.value;
				return {
					generatorId,
					generatorName: generatorCatalog.getGenerator(generatorId, locale).name,
					entryId: selection.entryId,
					outputType: 'fields',
					fields,
					displayFields: fields,
					provenance: [{
						type: 'entry',
						selection: 'fixed',
						generatorId: CREATURE_ROUTER_ID,
						entryId: type,
						path: 'root.traversal.0',
					}, ...result.provenance],
					modifiers: result.modifiers ?? [],
				};
			}
			return generatorResolver.generate(path, locale, options);
		},
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
		resolveInlineString(value, locale, options) {
			return generatorResolver.resolveInlineString(value, locale, options);
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

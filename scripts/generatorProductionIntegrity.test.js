const assert = require('node:assert/strict');
const { test } = require('node:test');
const generatorCatalog = require('../services/generatorCatalog');
const generatorResolver = require('../services/generatorResolver');
const {
	isGeneratorRouter,
	validateRoutedArchetypeStatProfileRelationships,
} = require('../services/generatorSchema');
const {
	extractInlineReferences,
} = require('../services/generatorSchema/referenceValidation');
const {
	getGenerationStatProfileId,
} = require('../services/generationMetadata');
const {
	getResolvedLootArmorPercentage,
} = require('../services/lootGeneration');
const {
	ARMOR_PERCENTAGES,
	SHIELD_PERCENTAGES,
} = require('../services/mechanics/armor');
const {
	createStatProfileCandidate,
} = require('../services/statProfileCatalog');

const CATEGORY_ROUTER_IDS = Object.freeze([
	'background',
	'creature',
	'loot',
	'site',
	'group',
	'modifier',
]);

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
	for (const locale of ['en', 'fr']) {
		for (const generator of catalogs.get(locale).values()) {
			assert.equal(generator.schemaVersion, 4, `${locale}:${generator.id}`);
		}
		for (const generatorId of ['modifier_character', 'modifier_creature']) {
			const modifier = catalogs.get(locale).get(generatorId);
			assert.equal(modifier.visibility, 'internal');
			assert.equal(isGeneratorRouter(modifier), false);
			assert.deepEqual(modifier.entrySchema.required, ['description']);
		}
	}
});

test('character modifiers keep major impairments distinct from rare transformations', () => {
	const impairmentIds = [
		'scarred',
		'one_eyed',
		'damaged_lungs',
		'prosthetic_limb',
		'missing_fingers',
		'noticeable_limp',
		'impaired_hearing',
		'missing_hand',
		'missing_arm',
		'missing_leg',
	];
	const transformationIds = [
		'giant_blooded',
		'juggernaut',
		'unbreakable',
		'arcane_vessel',
		'living_conduit',
		'berserker',
		'shadow_touched',
		'phoenix_touched',
		'predatory_senses',
		'runic_body',
		'monstrous_physique',
		'unstable_mutation',
		'rule_bearer',
		'race_hybrid',
		'creature_hybrid',
	];
	const removedModifierIds = [
		'light_sensitive',
		'unmistakable',
		'weathered',
		'publicly_branded',
		'oathbound',
		'chronic_tremor',
		'magic_saturated',
		'haunted',
	];

	for (const locale of ['en', 'fr']) {
		const modifiers = generatorCatalog.getGenerator('modifier_character', locale);
		const entries = new Map(modifiers.entries.map(entry => [entry.id, entry]));
		assert.ok(impairmentIds.every(id => entries.has(id)));
		assert.ok(transformationIds.every(id => entries.has(id)));
		assert.ok(removedModifierIds.every(id => !entries.has(id)));
		assert.ok(transformationIds.every(id => entries.get(id).weight === 1));
		assert.ok(impairmentIds.every(id => entries.get(id).weight > 1));
		assert.ok(
			transformationIds.reduce((total, id) => total + entries.get(id).weight, 0)
			< impairmentIds.reduce((total, id) => total + entries.get(id).weight, 0),
		);
		assert.deepEqual(
			extractInlineReferences(entries.get('rule_bearer').fields.description),
			['rules.name'],
		);
		assert.deepEqual(
			extractInlineReferences(entries.get('race_hybrid').fields.description),
			['race.name'],
		);
		assert.deepEqual(
			extractInlineReferences(entries.get('creature_hybrid').fields.description),
			['creature.generator.name'],
		);

		const talents = generatorCatalog.getGenerator('talents', locale);
		assert.ok(talents.entries.some(entry => entry.id === 'weather_hardened'));
		const afflictions = generatorCatalog.getGenerator('affliction', locale);
		for (const id of ['oathbrand', 'haunting_presence']) {
			const affliction = afflictions.entries.find(entry => entry.id === id);
			assert.ok(affliction);
			assert.equal(affliction.fields.type, locale === 'fr' ? 'malédiction' : 'curse');
		}
	}
});

test('every production quest, rumor, and secret resolves references with provenance', () => {
	for (const locale of ['en', 'fr']) {
		for (const generatorId of ['quest', 'rumor', 'secret']) {
			const entries = generatorCatalog.getGenerator(generatorId, locale).entries;
			for (const entry of entries) {
				const sourceValues = [entry.name, ...Object.values(entry.fields ?? {})];
				const hasInlineReference = sourceValues.some(value => (
					typeof value === 'string' && value.includes('{{')
				));
				const result = generatorResolver.resolveReference(
					`${generatorId}:${entry.id}`,
					locale,
					{ random: () => 0 },
				);
				assert.ok(result?.display);
				assert.doesNotMatch(result.display, /\{\{|\}\}/);
				assert.equal(result.provenance[0].generatorId, generatorId);
				assert.equal(result.provenance[0].entryId, entry.id);
				if (hasInlineReference) {
					assert.ok(result.provenance.length > 1, `${locale}:${generatorId}:${entry.id}`);
				}
			}
		}
	}
});

test('production category routers are minimal and traverse their canonical children', () => {
	for (const locale of ['en', 'fr']) {
		for (const routerId of CATEGORY_ROUTER_IDS) {
			const router = generatorCatalog.getGenerator(routerId, locale);
			assert.equal(router.visibility, 'public');
			assert.equal(isGeneratorRouter(router), true);
			assert.deepEqual(router.entrySchema.required, []);
			assert.ok(router.entries.length > 0);
			assert.ok(router.entries.every(entry => (
				Object.keys(entry).every(key => (
					['id', 'name', 'weight', 'generator'].includes(key)
				))
			)));
			for (const route of router.entries) {
				const child = generatorCatalog.getGenerator(route.generator, locale);
				assert.equal(child.visibility, 'internal');
				const result = generatorResolver.generate(
					`${routerId}:${route.id}`,
					locale,
					{ random: () => 0.5 },
				);
				assert.ok(result);
				assert.ok(result.value || Object.keys(result.displayFields ?? {}).length > 0);
				assert.deepEqual(
					result.provenance.slice(0, 2).map(record => record.generatorId),
					[routerId, route.generator],
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

test('every routed creature archetype resolves with a valid statistical profile', () => {
	const profiles = createStatProfileCandidate();
	const englishRouter = generatorCatalog.getGenerator('creature', 'en');
	const frenchRouter = generatorCatalog.getGenerator('creature', 'fr');
	assert.deepEqual(
		frenchRouter.entries.map(entry => [entry.id, entry.generator]),
		englishRouter.entries.map(entry => [entry.id, entry.generator]),
	);
	for (const route of englishRouter.entries) {
		const english = generatorCatalog.getGenerator(route.generator, 'en');
		const french = generatorCatalog.getGenerator(route.generator, 'fr');
		assert.deepEqual(
			french.entries.map(entry => entry.id),
			english.entries.map(entry => entry.id),
		);
		for (const [index, entry] of english.entries.entries()) {
			const frenchEntry = french.entries[index];
			const profileId = getGenerationStatProfileId(entry.generation);
			assert.ok(profiles.has(profileId), `${route.generator}:${entry.id}:${profileId}`);
			assert.equal(getGenerationStatProfileId(frenchEntry.generation), profileId);
			for (const locale of ['en', 'fr']) {
				const result = generatorResolver.generate(
					`creature:${route.id}:${entry.id}`,
					locale,
					{ random: () => 0 },
				);
				assert.equal(result.generatorId, route.generator);
				assert.equal(result.entryId, entry.id);
				assert.doesNotMatch(result.display, /\{\{|\}\}/);
			}
		}
	}
});

test('routed generation metadata references resolve without entry-specific mappings', () => {
	for (const locale of ['en', 'fr']) {
		for (const routerId of ['background', 'creature']) {
			const router = generatorCatalog.getGenerator(routerId, locale);
			for (const route of router.entries) {
				const generator = generatorCatalog.getGenerator(route.generator, locale);
				for (const entry of generator.entries) {
					const generation = entry.generation ?? {};
					const references = [
						...(generation.fixedRules ?? []).map(rule => `rules:${rule.entry}`),
						...(generation.statusEffects ?? []),
						...(generation.modifiers ?? []),
						...(generation.armor ? [generation.armor] : []),
						...(generation.equipment ?? []),
						...(generation.inventory ?? []),
					];
					for (const reference of references) {
						const result = generatorResolver.resolveReference(
							reference,
							locale,
							{ random: () => 0 },
						);
						assert.doesNotMatch(getResolvedText(result), /\{\{|\}\}/);
					}
					for (const template of [
						...(generation.talents ?? []),
						...(generation.traits ?? []),
					]) {
						const result = generatorResolver.resolveInlineString(
							template,
							locale,
							{ random: () => 0 },
						);
						assert.doesNotMatch(result.value, /\{\{|\}\}/);
					}
				}
			}
		}
	}
});

test('loot uses routed heterogeneous content instead of an inventory generator', () => {
	assert.equal(generatorCatalog.getGenerator('inventory'), undefined);
	for (const locale of ['en', 'fr']) {
		const loot = generatorCatalog.getGenerator('loot', locale);
		for (const route of loot.entries) {
			const generator = generatorCatalog.getGenerator(route.generator, locale);
			assert.equal(generator.visibility, 'internal');
			assert.ok(generator.entries.length > 0);
			assert.ok(generator.entrySchema.required.includes('description'));
			for (const entry of generator.entries) {
				assert.equal(typeof entry.fields.description, 'string');
				const result = generatorResolver.generate(
					`loot:${route.id}:${entry.id}`,
					locale,
					{ random: () => 0 },
				);
				assert.equal(result.generatorId, route.generator);
				assert.equal(result.entryId, entry.id);
				assert.doesNotMatch(result.display, /\{\{|\}\}/);
			}
		}
	}
});

test('loot generators preserve the configured modifier mechanics and ordering', () => {
	const equipmentModifiers = {
		modifier_rarity: 100,
		modifier_material: 15,
		modifier_loot: 10,
	};
	for (const locale of ['en', 'fr']) {
		for (const generatorId of ['weapons', 'shields', 'armors']) {
			assert.deepEqual(
				generatorCatalog.getGenerator(generatorId, locale).modifiers,
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
			assert.deepEqual(generatorCatalog.getGenerator(generatorId, locale).modifiers, {
				modifier_loot: percentage,
			});
		}
		assert.equal(generatorCatalog.getGenerator('material', locale).modifiers, undefined);
	}

	const mechanicalRarityIds = Object.keys(SHIELD_PERCENTAGES);
	for (const percentages of Object.values(ARMOR_PERCENTAGES)) {
		assert.deepEqual(Object.keys(percentages), mechanicalRarityIds);
	}
	assert.deepEqual(
		generatorCatalog.getGenerator('modifier_rarity', 'en').entries
			.map(entry => entry.id)
			.sort(),
		[...mechanicalRarityIds].sort(),
	);
	for (const locale of ['en', 'fr']) {
		const router = generatorCatalog.getGenerator('modifier', locale);
		for (const route of router.entries) {
			const generator = generatorCatalog.getGenerator(route.generator, locale);
			for (const entry of generator.entries) {
				const result = generatorResolver.resolveReference(
					`${generator.id}:${entry.id}`,
					locale,
					{ random: () => 0 },
				);
				assert.doesNotMatch(result.display, /\{\{|\}\}/);
			}
		}
	}
});

function getResolvedText(result) {
	return [
		result?.display,
		JSON.stringify(result?.displayFields),
		JSON.stringify(result?.value),
	].filter(Boolean).join(' ');
}

test('direct loot generation keeps modifiers separate from the base result', () => {
	const weapon = generatorCatalog.getGenerator('weapons', 'en').entries[0];
	const result = generatorResolver.generate(
		`loot:weapons:${weapon.id}`,
		'en',
		{ random: () => 0 },
	);
	assert.deepEqual(
		Object.keys(result.displayFields),
		['name', ...generatorCatalog.getGenerator('weapons', 'en').entrySchema.required],
	);
	assert.deepEqual(result.modifiers.map(modifier => modifier.generatorId), [
		'modifier_rarity',
		'modifier_material',
		'modifier_loot',
	]);
	assert.deepEqual(
		generatorResolver.generate(
			`loot:weapons:${weapon.id}.description`,
			'en',
			{ random: () => 0 },
		).modifiers,
		[],
	);
	for (const [generatorId, belowThreshold, threshold] of [
		['supplies', 0.099999, 0.1],
		['food_and_drink', 0.049999, 0.05],
	]) {
		const entry = generatorCatalog.getGenerator(generatorId, 'en').entries[0];
		assert.equal(
			generatorResolver.generate(`loot:${generatorId}:${entry.id}`, 'en', {
				random: () => belowThreshold,
			}).modifiers.length,
			1,
		);
		assert.equal(
			generatorResolver.generate(`loot:${generatorId}:${entry.id}`, 'en', {
				random: () => threshold,
			}).modifiers.length,
			0,
		);
	}
});

test('armor and shield mechanics use stable types and rarity IDs, not localized text', () => {
	const armorTypes = Object.keys(ARMOR_PERCENTAGES);
	for (const locale of ['en', 'fr']) {
		const armors = generatorCatalog.getGenerator('armors', locale);
		assert.deepEqual(armors.entrySchema.required, ['type', 'description']);
		assert.ok(armors.entries.every(entry => (
			armorTypes.includes(entry.fields.type)
				&& !Object.hasOwn(entry.fields, 'rarity')
				&& !Object.hasOwn(entry.fields, 'constitution_requirement')
				&& !Object.hasOwn(entry.fields, 'ar_percentage')
		)));
		const shields = generatorCatalog.getGenerator('shields', locale);
		assert.deepEqual(shields.entrySchema.required, ['description']);
		assert.ok(shields.entries.every(entry => (
			!Object.hasOwn(entry.fields, 'rarity')
				&& !Object.hasOwn(entry.fields, 'ar_percentage')
		)));
		for (const [generator, percentages] of [
			[armors, ARMOR_PERCENTAGES],
			[shields, SHIELD_PERCENTAGES],
		]) {
			for (const entry of generator.entries) {
				const result = generatorResolver.resolveReference(
					`${generator.id}:${entry.id}`,
					locale,
					{ random: () => 0 },
				);
				const rarityId = result.modifiers.find(modifier => (
					modifier.generatorId === 'modifier_rarity'
				)).entryId;
				const expected = generator.id === 'armors'
					? percentages[entry.fields.type][rarityId]
					: percentages[rarityId];
				assert.equal(getResolvedLootArmorPercentage(result), expected);
			}
		}
	}
});

test('ability remains an open-ended public name-only vocabulary', () => {
	const english = generatorCatalog.getGenerator('ability', 'en');
	const french = generatorCatalog.getGenerator('ability', 'fr');
	for (const ability of [english, french]) {
		assert.equal(ability.visibility, 'public');
		assert.deepEqual(ability.entrySchema.required, []);
		assert.ok(ability.entries.length > 0);
		assert.ok(ability.entries.every(entry => (
			Object.keys(entry).every(key => ['id', 'name', 'weight'].includes(key))
				&& typeof entry.name === 'string'
				&& entry.name.trim()
		)));
	}
	assert.deepEqual(
		french.entries.map(entry => entry.id),
		english.entries.map(entry => entry.id),
	);
});

test('consumable ability and affliction references resolve in both locales', () => {
	const english = generatorCatalog.getGenerator('consumable', 'en');
	const referencedRoots = new Set();
	const referencedEntryIds = [];
	for (const entry of english.entries) {
		const source = [entry.name, ...Object.values(entry.fields)].join(' ');
		const roots = [...source.matchAll(/\{\{\s*([a-z0-9_]+)/g)]
			.map(match => match[1]);
		for (const root of roots) {
			referencedRoots.add(root);
		}
		if (roots.some(root => ['ability', 'affliction'].includes(root))) {
			referencedEntryIds.push(entry.id);
		}
	}
	assert.ok(referencedRoots.has('ability'));
	assert.ok(referencedRoots.has('affliction'));
	for (const locale of ['en', 'fr']) {
		for (const entryId of referencedEntryIds) {
			const result = generatorResolver.generate(
				`loot:consumable:${entryId}`,
				locale,
				{ random: () => 0 },
			);
			assert.doesNotMatch(Object.values(result.displayFields).join(' '), /\{\{|\}\}/);
		}
	}
});

test('affliction classifications and referenced symptoms stay localized and resolvable', () => {
	const english = generatorCatalog.getGenerator('affliction', 'en');
	const french = generatorCatalog.getGenerator('affliction', 'fr');
	assert.deepEqual(english.entrySchema.required, ['type', 'description']);
	assert.deepEqual(french.entrySchema.required, ['type', 'description']);
	const frenchById = new Map(french.entries.map(entry => [entry.id, entry]));
	const localizedTypes = new Map();
	for (const entry of english.entries) {
		assert.ok(['disease', 'curse'].includes(entry.fields.type));
		const frenchEntry = frenchById.get(entry.id);
		assert.ok(frenchEntry);
		const knownTranslation = localizedTypes.get(entry.fields.type);
		if (knownTranslation) {
			assert.equal(frenchEntry.fields.type, knownTranslation);
		}
		else {
			localizedTypes.set(entry.fields.type, frenchEntry.fields.type);
		}
		if (entry.fields.description.includes('{{')) {
			for (const locale of ['en', 'fr']) {
				const result = generatorResolver.resolveReference(
					`affliction:${entry.id}.description`,
					locale,
					{ random: () => 0 },
				);
				assert.doesNotMatch(result.displayFields.description, /\{\{|\}\}/);
				assert.ok(result.provenance.length > 1);
			}
		}
	}
	assert.deepEqual(new Set(localizedTypes.keys()), new Set(['disease', 'curse']));
	assert.equal(new Set(localizedTypes.values()).size, 2);
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

test('every production generator entry resolves through a valid localized path', () => {
	const catalogs = generatorCatalog.createGeneratorCatalogCandidate();
	const englishCatalog = catalogs.get('en');
	const frenchCatalog = catalogs.get('fr');
	const routedEntryPaths = new Map([
		['en', collectRoutedEntryPaths(englishCatalog)],
		['fr', collectRoutedEntryPaths(frenchCatalog)],
	]);

	assert.deepEqual(
		[...englishCatalog.keys()],
		[...frenchCatalog.keys()],
		'production catalogs must expose the same stable generator IDs',
	);

	let checkedEntries = 0;
	for (const englishGenerator of englishCatalog.values()) {
		const frenchGenerator = frenchCatalog.get(englishGenerator.id);
		assert.ok(frenchGenerator, `Missing French generator ${englishGenerator.id}.`);
		assert.deepEqual(
			getFunctionalGeneratorProjection(englishGenerator),
			getFunctionalGeneratorProjection(frenchGenerator),
			`Functional EN/FR divergence for ${englishGenerator.id}.`,
		);

		for (const englishEntry of englishGenerator.entries) {
			const frenchEntry = frenchGenerator.entries.find(entry => (
				entry.id === englishEntry.id
			));
			assert.ok(
				frenchEntry,
				`Missing French entry ${englishGenerator.id}:${englishEntry.id}.`,
			);

			const results = new Map();
			for (const [locale, catalog] of catalogs) {
				const generator = catalog.get(englishGenerator.id);
				const entry = generator.entries.find(candidate => (
					candidate.id === englishEntry.id
				));
				const result = resolveProductionEntry(
					catalog,
					generator,
					entry,
					routedEntryPaths.get(locale),
				);
				const context = `${locale}:${generator.id}:${entry.id}`;
				assert.ok(result, `${context} did not resolve.`);
				assertFinalGeneratorOutput(result, catalog, context);
				assertProvenanceReferencesCatalog(result, catalog, context);
				assert.ok(
					result.provenance.some(record => (
						record.generatorId === generator.id
						&& record.entryId === entry.id
					)),
					`${context} is missing its source provenance.`,
				);
				results.set(locale, result);
				checkedEntries += 1;
			}

			const englishResult = results.get('en');
			const frenchResult = results.get('fr');
			assert.deepEqual(
				getStableResultProjection(englishResult),
				getStableResultProjection(frenchResult),
				`Resolved EN/FR identity divergence for ${englishGenerator.id}:${englishEntry.id}.`,
			);
		}
	}
	assert.ok(checkedEntries > 0);
});

function collectRoutedEntryPaths(catalog) {
	const paths = new Map();
	for (const generator of catalog.values()) {
		if (generator.visibility !== 'public') {
			continue;
		}
		collectEntryPaths(generator, generator.id, new Set(), paths, catalog);
	}
	return paths;
}

function collectEntryPaths(generator, prefix, ancestors, paths, catalog) {
	if (ancestors.has(generator.id)) {
		return;
	}
	const nextAncestors = new Set(ancestors).add(generator.id);
	for (const entry of generator.entries) {
		const entryPath = `${prefix}:${entry.id}`;
		const entryKey = `${generator.id}:${entry.id}`;
		if (!paths.has(entryKey)) {
			paths.set(entryKey, entryPath);
		}
		if (!isGeneratorRouter(generator)) {
			continue;
		}
		const child = catalog.get(entry.generator);
		if (child) {
			collectEntryPaths(child, entryPath, nextAncestors, paths, catalog);
		}
	}
}

function resolveProductionEntry(catalog, generator, entry, routedEntryPaths) {
	const directPath = `${generator.id}:${entry.id}`;
	const routedPath = routedEntryPaths.get(`${generator.id}:${entry.id}`);
	const random = createDataDrivenRandom(directPath);
	if (generator.visibility === 'public') {
		return generatorResolver.generate(directPath, generator.locale, { random });
	}
	if (routedPath && routedPath.split(':')[0] !== generator.id) {
		return generatorResolver.generate(routedPath, generator.locale, { random });
	}
	return generatorResolver.resolveReference(directPath, generator.locale, { random });
}

function createDataDrivenRandom(seed) {
	let state = 2166136261;
	for (const character of seed) {
		state = Math.imul(state ^ character.charCodeAt(0), 16777619) >>> 0;
	}
	return () => {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
		return state / 0x100000000;
	};
}

function assertFinalGeneratorOutput(result, catalog, context) {
	assert.equal(typeof result.display, 'string', `${context} has no display output.`);
	assert.ok(result.display.trim(), `${context} has an empty display output.`);
	assert.doesNotMatch(result.display, /\{\{|\}\}/, `${context} left template syntax in display.`);
	const finalGenerator = catalog.get(result.generatorId);
	assert.ok(finalGenerator, `${context} has unknown final generator provenance.`);
	const finalEntry = finalGenerator?.entries.find(entry => entry.id === result.entryId);
	assert.ok(finalEntry, `${context} has unknown final entry identity.`);
	assert.ok(
		result.provenance?.some(record => (
			record.generatorId === result.generatorId
			&& record.entryId === result.entryId
		)),
		`${context} final identity is missing from provenance.`,
	);
	if (result.outputType === 'value') {
		assert.equal(finalGenerator.entrySchema.required.length, 0, `${context} has invalid value output.`);
		assert.equal(typeof result.value, 'string', `${context} has no final value.`);
		assert.ok(result.value.trim(), `${context} has an empty final value.`);
		assert.doesNotMatch(result.value, /\{\{|\}\}/, `${context} left template syntax in value.`);
	}
	else {
		assert.equal(result.outputType, 'fields', `${context} has an invalid output type.`);
		assert.deepEqual(
			Object.keys(result.displayFields ?? {}),
			['name', ...finalGenerator.entrySchema.required],
			`${context} has an incomplete final field set.`,
		);
		for (const [field, value] of Object.entries(result.displayFields ?? {})) {
			assert.equal(typeof value, 'string', `${context} field ${field} is not displayable.`);
			assert.ok(value.trim(), `${context} field ${field} is empty.`);
			assert.doesNotMatch(value, /\{\{|\}\}/, `${context} field ${field} left template syntax.`);
		}
	}
	for (const modifier of result.modifiers ?? []) {
		assertFinalGeneratorOutput(modifier, catalog, `${context}:modifier:${modifier.generatorId}`);
	}
}

function assertProvenanceReferencesCatalog(result, catalog, context) {
	assert.ok(Array.isArray(result.provenance) && result.provenance.length > 0, `${context} has no provenance.`);
	for (const record of result.provenance) {
		assert.equal(record.type, 'entry', `${context} has an invalid provenance type.`);
		assert.ok(['fixed', 'random'].includes(record.selection), `${context} has an invalid provenance selection.`);
		assert.equal(typeof record.path, 'string', `${context} has an invalid provenance path.`);
		const generator = catalog.get(record.generatorId);
		assert.ok(generator, `${context} references unknown generator ${record.generatorId}.`);
		assert.ok(
			generator.entries.some(entry => entry.id === record.entryId),
			`${context} references unknown entry ${record.generatorId}:${record.entryId}.`,
		);
	}
	for (const modifier of result.modifiers ?? []) {
		assertProvenanceReferencesCatalog(modifier, catalog, `${context}:modifier:${modifier.generatorId}`);
	}
}

function getFunctionalGeneratorProjection(generator) {
	return {
		schemaVersion: generator.schemaVersion,
		id: generator.id,
		visibility: generator.visibility,
		entrySchema: generator.entrySchema,
		modifiers: generator.modifiers,
		nameReferences: extractInlineReferences(generator.name),
		descriptionReferences: extractInlineReferences(generator.description),
		entries: generator.entries.map(entry => ({
			id: entry.id,
			weight: entry.weight,
			generator: entry.generator,
			nameReferences: extractInlineReferences(entry.name),
			fields: entry.fields === undefined
				? undefined
				: Object.fromEntries(Object.entries(entry.fields).map(([field, value]) => (
					[field, projectLocalizedValue(value)]
				))),
			generation: projectGeneration(entry.generation),
		})),
	};
}

function projectLocalizedValue(value) {
	return typeof value === 'string'
		? {
			type: 'localized-text',
			references: extractInlineReferences(value),
		}
		: value;
}

function projectGeneration(generation) {
	if (generation === undefined) {
		return undefined;
	}
	return Object.fromEntries(Object.entries(generation).map(([property, value]) => (
		[property, ['talents', 'traits'].includes(property)
			? value.map(template => extractInlineReferences(template))
			: value]
	)));
}

function getStableResultProjection(result) {
	return {
		generatorId: result.generatorId,
		entryId: result.entryId,
		outputType: result.outputType,
		fieldNames: Object.keys(result.displayFields ?? {}),
		provenance: result.provenance.map(record => ({
			type: record.type,
			selection: record.selection,
			generatorId: record.generatorId,
			entryId: record.entryId,
			path: record.path,
		})),
		modifiers: (result.modifiers ?? []).map(getStableResultProjection),
	};
}

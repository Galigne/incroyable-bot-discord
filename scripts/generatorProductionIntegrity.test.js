const assert = require('node:assert/strict');
const { test } = require('node:test');
const generatorCatalog = require('../services/generatorCatalog');
const generatorResolver = require('../services/generatorResolver');
const {
	isGeneratorRouter,
	validateGeneratorApplicationContracts,
} = require('../services/generatorSchema');
const {
	extractInlineReferences,
} = require('../services/generatorSchema/referenceValidation');
const {
	createStatProfileCandidate,
} = require('../services/statProfileCatalog');
const {
	getResolvedLootArmorPercentage,
} = require('../services/lootGeneration');
const {
	ARMOR_PERCENTAGES,
	SHIELD_PERCENTAGES,
} = require('../services/mechanics/armor');

test('production catalogs load as complete localized candidates under the application contract', () => {
	const catalogs = generatorCatalog.createGeneratorCatalogCandidate();
	assert.equal(validateGeneratorApplicationContracts(catalogs), true);
	assert.ok(catalogs.get('en') instanceof Map);
	assert.ok(catalogs.get('fr') instanceof Map);
	assert.deepEqual(
		[...catalogs.get('en').keys()],
		[...catalogs.get('fr').keys()],
	);
});

function getProductionEntry(generatorId, entryId, locale) {
	const entry = generatorCatalog.getGenerator(generatorId, locale).entries
		.find(candidate => candidate.id === entryId);
	assert.ok(entry, `${locale}:${generatorId}:${entryId}`);
	return entry;
}

test('reviewed generator compositions preserve their intended roles', () => {
	const expectedMonsterHunterDescriptions = {
		en: 'Specializes in {{ ability:hunting.name }} focused on the following creature: {{ creature:monster.generator.name }}. Gains +2 when following it using {{ ability:tracking.name }}, identifying it, recalling its weaknesses, or preparing to face it.',
		fr: 'Se spécialise dans une forme de {{ ability:hunting.name }} visant la créature suivante : {{ creature:monster.generator.name }}. Bénéficie de +2 pour la suivre grâce au {{ ability:tracking.name }}, l’identifier, se rappeler ses faiblesses ou préparer un affrontement contre elle.',
	};

	for (const locale of ['en', 'fr']) {
		const monsterHunter = getProductionEntry('talents', 'monster_hunter', locale);
		assert.equal(
			monsterHunter.fields.description,
			expectedMonsterHunterDescriptions[locale],
		);
		assert.deepEqual(
			extractInlineReferences(monsterHunter.fields.description),
			[
				'ability:hunting.name',
				'creature:monster.generator.name',
				'ability:tracking.name',
			],
		);

		const trophyGallery = getProductionEntry('room', 'trophy_gallery', locale);
		assert.deepEqual(
			extractInlineReferences(trophyGallery.fields.description),
			['weapons.name'],
		);

		const elementalEssence = getProductionEntry('material', 'elemental_essence', locale);
		assert.equal(
			elementalEssence.name,
			locale === 'en' ? 'Elemental Essence' : 'Essence élémentaire',
		);
		assert.deepEqual(extractInlineReferences(elementalEssence.name), []);
		assert.equal(
			elementalEssence.fields.description,
			locale === 'en'
				? 'An unstable substance bound to the element {{ element.name }}, retaining its natural or magical properties.'
				: 'Une substance instable liée à l’élément {{ element.name }}, dont elle conserve les propriétés naturelles ou magiques.',
		);
		assert.deepEqual(
			extractInlineReferences(elementalEssence.fields.description),
			['element.name'],
		);
	}

	const wallClimber = getProductionEntry('traits', 'wall_climber', 'fr');
	assert.equal(
		wallClimber.fields.description,
		'Peut se déplacer sur des surfaces rugueuses très inclinées ou verticales à la moitié de sa vitesse normale sans devoir effectuer un jet ordinaire d’{{ ability:climbing.name }}.',
	);
	assert.deepEqual(
		extractInlineReferences(wallClimber.fields.description),
		['ability:climbing.name'],
	);
});

test('site weather modifiers keep static names and reuse only fixed descriptions', () => {
	const expectedNames = {
		en: {
			heavy_rain: 'Heavy Rain',
			thunderstorm: 'Thunderstorm',
			dense_fog: 'Dense Fog',
			strong_winds: 'Strong Winds',
			heavy_snow: 'Heavy Snow',
			cold_snap: 'Cold Snap',
			heat_wave: 'Heat Wave',
			hailstorm: 'Hailstorm',
			dust_storm: 'Dust Storm',
			ashfall: 'Ashfall',
		},
		fr: {
			heavy_rain: 'Pluie battante',
			thunderstorm: 'Orage violent',
			dense_fog: 'Brouillard dense',
			strong_winds: 'Vents violents',
			heavy_snow: 'Fortes chutes de neige',
			cold_snap: 'Vague de froid',
			heat_wave: 'Canicule',
			hailstorm: 'Averse de grêle',
			dust_storm: 'Tempête de poussière',
			ashfall: 'Pluie de cendres',
		},
	};

	for (const locale of ['en', 'fr']) {
		for (const [entryId, localizedName] of Object.entries(expectedNames[locale])) {
			const modifier = getProductionEntry(
				'modifier_site_all',
				entryId,
				locale,
			);
			assert.equal(modifier.name, localizedName);
			assert.deepEqual(extractInlineReferences(modifier.name), []);
			assert.deepEqual(
				extractInlineReferences(modifier.fields.description),
				[`weather:${entryId}.description`],
			);

			const resolved = generatorResolver.resolveReference(
				`modifier_site_all:${entryId}`,
				locale,
				{ random: () => 0.999999 },
			);
			assert.deepEqual(
				resolved.provenance
					.filter(record => record.generatorId === 'weather')
					.map(record => record.entryId),
				[entryId],
			);
		}

		const gatheringStorm = getProductionEntry('event', 'gathering_storm', locale);
		assert.deepEqual(
			extractInlineReferences(gatheringStorm.fields.description),
			['weather'],
		);
		const resolvedStorm = generatorResolver.resolveReference(
			'event:gathering_storm',
			locale,
			{ random: () => 0.999999 },
		);
		assert.deepEqual(
			resolvedStorm.provenance
				.filter(record => record.generatorId === 'weather')
				.map(record => record.entryId),
			['ashfall'],
		);
	}
});

test('every production entry resolves without leaking templates or invalid provenance', () => {
	const catalogs = generatorCatalog.createGeneratorCatalogCandidate();
	for (const locale of ['en', 'fr']) {
		const catalog = catalogs.get(locale);
		for (const generator of catalog.values()) {
			for (const entry of generator.entries) {
				const result = generator.visibility === 'public'
					? generatorResolver.generate(`${generator.id}:${entry.id}`, locale, {
						random: () => 0.37,
					})
					: generatorResolver.resolveReference(`${generator.id}:${entry.id}`, locale, {
						random: () => 0.37,
					});
				assertResolvedResult(result, catalog, `${locale}:${generator.id}:${entry.id}`);
			}
		}
	}
});

test('production public generators preserve stable selection identities across locales', () => {
	for (const generator of generatorCatalog.listGenerators('en')) {
		for (const randomValue of [0, 0.37, 0.999999]) {
			const english = generatorResolver.generate(generator.id, 'en', {
				random: () => randomValue,
			});
			const french = generatorResolver.generate(generator.id, 'fr', {
				random: () => randomValue,
			});
			assert.deepEqual(
				getStableResultProjection(english),
				getStableResultProjection(french),
				`${generator.id}:${randomValue}`,
			);
		}
	}
});

test('production routed generation metadata resolves for every localized archetype', () => {
	const catalogs = generatorCatalog.createGeneratorCatalogCandidate();
	const profiles = createStatProfileCandidate();
	for (const locale of ['en', 'fr']) {
		const catalog = catalogs.get(locale);
		for (const routerId of ['background', 'creature']) {
			const router = catalog.get(routerId);
			assert.equal(isGeneratorRouter(router), true);
			for (const route of router.entries) {
				const child = catalog.get(route.generator);
				for (const entry of child.entries) {
					const profileId = entry.generation?.statProfile ?? 'default';
					assert.ok(profiles.has(profileId), `${locale}:${child.id}:${entry.id}`);
					for (const reference of collectGenerationReferences(entry.generation)) {
						const result = generatorResolver.resolveReference(reference, locale, {
							random: () => 0,
						});
						assert.doesNotMatch(getResolvedText(result), /\{\{|\}\}/u);
					}
					for (const template of [
						...(entry.generation?.talents ?? []),
						...(entry.generation?.traits ?? []),
					]) {
						const result = generatorResolver.resolveInlineString(template, locale, {
							random: () => 0,
						});
						assert.doesNotMatch(result.value, /\{\{|\}\}/u);
					}
				}
			}
		}
	}
});

test('production armor and shield results use the stable rarity mechanics', () => {
	for (const locale of ['en', 'fr']) {
		for (const generatorId of ['armors', 'shields']) {
			const generator = generatorCatalog.getGenerator(generatorId, locale);
			for (const entry of generator.entries) {
				const result = generatorResolver.resolveReference(
					`${generatorId}:${entry.id}`,
					locale,
					{ random: () => 0 },
				);
				const percentage = getResolvedLootArmorPercentage(result);
				const expectedPercentages = generatorId === 'armors'
					? ARMOR_PERCENTAGES[entry.fields.type]
					: SHIELD_PERCENTAGES;
				assert.equal(
					percentage,
					expectedPercentages[result.modifiers.find(
						modifier => modifier.generatorId === 'modifier_rarity',
					).entryId],
				);
			}
		}
	}
});

function collectGenerationReferences(generation = {}) {
	return [
		...(generation.fixedRules ?? []).map(rule => `rules:${rule.entry}`),
		...(generation.statusEffects ?? []),
		...(generation.modifiers ?? []),
		...(generation.armor ? [generation.armor] : []),
		...(generation.equipment ?? []),
		...(generation.inventory ?? []),
	];
}

function getResolvedText(result) {
	return [
		result?.display,
		JSON.stringify(result?.displayFields),
		JSON.stringify(result?.value),
	].filter(Boolean).join(' ');
}

function assertResolvedResult(result, catalog, context) {
	assert.ok(result, `${context} did not resolve.`);
	assert.equal(typeof result.display, 'string', `${context} has no display.`);
	assert.ok(result.display.trim(), `${context} has an empty display.`);
	assert.doesNotMatch(result.display, /\{\{|\}\}/u, `${context} left a template.`);
	assert.ok(Array.isArray(result.provenance) && result.provenance.length > 0);
	for (const record of result.provenance) {
		assert.equal(record.type, 'entry', `${context} has invalid provenance.`);
		assert.ok(['fixed', 'random'].includes(record.selection));
		assert.ok(catalog.get(record.generatorId));
		assert.ok(catalog.get(record.generatorId).entries.some(entry => (
			entry.id === record.entryId
		)));
	}
	if (result.outputType === 'value') {
		assert.equal(typeof result.value, 'string');
		assert.ok(result.value.trim());
	}
	else {
		assert.equal(result.outputType, 'fields');
		for (const value of Object.values(result.displayFields ?? {})) {
			assert.equal(typeof value, 'string');
			assert.ok(value.trim());
			assert.doesNotMatch(value, /\{\{|\}\}/u);
		}
	}
	for (const modifier of result.modifiers ?? []) {
		assertResolvedResult(modifier, catalog, `${context}:modifier`);
	}
}

function getStableResultProjection(result) {
	return {
		generatorId: result.generatorId,
		entryId: result.entryId,
		outputType: result.outputType,
		fieldNames: Object.keys(result.displayFields ?? {}),
		provenance: (result.provenance ?? []).map(record => ({
			type: record.type,
			selection: record.selection,
			generatorId: record.generatorId,
			entryId: record.entryId,
			path: record.path,
		})),
		modifiers: (result.modifiers ?? []).map(getStableResultProjection),
	};
}

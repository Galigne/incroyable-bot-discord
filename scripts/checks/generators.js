const {
	getStatProfile,
	listStatProfiles,
} = require('../../services/statProfileCatalog');
const {
	getEntryWeight,
	selectWeightedEntry,
} = require('../../services/weightedSelector');
const generatorResolver = require('../../services/generatorResolver');
const {
	COMMON_GENERATION_PROPERTIES,
	DEFAULT_STAT_PROFILE_ID,
	getGenerationStatProfileId,
} = require('../../services/generationMetadata');

module.exports = function createGeneratorChecks(context) {
	const {
		errors,
		generatorCatalog,
	} = context;

	function checkGeneratorCatalog() {
		try {
			const publicGenerators = generatorCatalog.listGenerators('en');
			const allGenerators = generatorCatalog.listGenerators('en', {
				visibility: 'all',
			});
			const internalGenerators = generatorCatalog.listGenerators('en', {
				visibility: 'internal',
			});
			if (
				publicGenerators.length === 0
				|| allGenerators.length !== publicGenerators.length + internalGenerators.length
			) {
				errors.push('Generator v4 visibility or schema filtering is incorrect.');
			}

			const englishRace = generatorCatalog.getGenerator('race', 'en');
			const frenchRace = generatorCatalog.getGenerator('race', 'fr');
			if (
				englishRace === frenchRace
				|| englishRace?.id !== 'race'
				|| frenchRace?.id !== 'race'
				|| englishRace?.entries[0]?.id !== 'human'
				|| frenchRace?.entries[0]?.id !== 'human'
				|| englishRace?.entries[0]?.name !== 'Human'
				|| frenchRace?.entries[0]?.name !== 'Humain'
				|| generatorCatalog.getGenerator('race', 'fr') !== frenchRace
			) {
				errors.push('Generator catalogs are not localized and cached by stable ID.');
			}

			for (const generator of publicGenerators) {
				const firstResult = generatorResolver.generate(generator.id, 'en', {
					random: () => 0,
				});
				if (firstResult?.entryId !== generator.entries[0].id) {
					errors.push(`Generator ${generator.id} cannot select its first entry.`);
				}
			}
			for (const generator of internalGenerators) {
				if (
					generatorCatalog.getGenerator(generator.id, 'en') !== generator
					|| generatorResolver.generate(generator.id, 'en', {
						random: () => 0,
					}) !== null
				) {
					errors.push(`Internal generator ${generator.id} has invalid visibility behavior.`);
				}
			}

			const weightedEntries = [
				{ id: 'default-weight', name: 'Default weight' },
				{ id: 'double-weight', name: 'Double weight', weight: 2 },
			];
			if (
				getEntryWeight(weightedEntries[0]) !== 1
				|| getEntryWeight(weightedEntries[1]) !== 2
				|| selectWeightedEntry(weightedEntries, () => 0) !== weightedEntries[0]
				|| selectWeightedEntry(weightedEntries, () => 0.5) !== weightedEntries[1]
			) {
				errors.push('Weighted generator selection is not working correctly.');
			}

			checkRequiredGenerators(errors, generatorCatalog);
			checkBackgroundGenerators(errors, generatorCatalog);
			checkCategoryRouters(errors, generatorCatalog);
			checkPhysicalDescriptionGenerator(errors, generatorCatalog);
			checkCreatureGenerators(errors, generatorCatalog);
			checkStructuredGenerators(errors, generatorCatalog);
			checkGeneratorResponses(errors, generatorCatalog, weightedEntries);
			checkStatProfiles(errors);
		}
		catch (error) {
			errors.push(`Generator catalog: ${error.message}`);
		}
	}

	return {
		checkGeneratorCatalog,
	};
};

function checkRequiredGenerators(errors, generatorCatalog) {
	const requiredPublicGenerators = [
		'affliction',
		'background',
		'creature',
		'event',
		'group',
		'loot',
		'modifier',
		'name',
		'personality',
		'quest',
		'race',
		'rules',
		'rumor',
		'secret',
		'site',
		'status_effect',
		'talents',
		'trap',
		'traits',
	];
	const publicIds = new Set(
		generatorCatalog.listGenerators('en').map(generator => generator.id),
	);
	for (const generatorId of requiredPublicGenerators) {
		if (!publicIds.has(generatorId)) {
			errors.push(`Missing public generator: ${generatorId}.`);
		}
	}
	if (generatorCatalog.getGenerator('inventory')) {
		errors.push('The removed inventory generator is still available.');
	}

	for (const generatorId of [
		'building',
		'dungeon',
		'faction',
		'government',
		'material',
		'region',
		'religion',
		'room',
		'settlement',
	]) {
		const entryCount = generatorCatalog.getGenerator(generatorId)?.entries.length ?? 0;
		if (entryCount < 20) {
			errors.push(`Generator ${generatorId} must contain at least 20 entries.`);
		}
	}
}

function checkBackgroundGenerators(errors, generatorCatalog) {
	const backgrounds = generatorCatalog.getGenerator('background')?.entries ?? [];
	const backgroundIds = new Set();
	for (const background of backgrounds) {
		const routedGeneratorId = background.generator;
		const details = generatorCatalog.getGenerator(routedGeneratorId)?.entries ?? [];
		if (
			!background.id
			|| !background.name
			|| backgroundIds.has(background.id)
			|| routedGeneratorId !== background.id
			|| details.length === 0
			|| generatorCatalog.getGenerator(routedGeneratorId)?.visibility !== 'internal'
			|| generatorCatalog.getGenerator(routedGeneratorId)?.entrySchema.required.length !== 0
			|| details.some(entry => (
				typeof entry.name !== 'string'
				|| !entry.name.trim()
				|| Object.keys(entry.generation ?? {}).some(property => (
					![...COMMON_GENERATION_PROPERTIES, 'talents'].includes(property)
				))
				|| Object.hasOwn(entry.generation ?? {}, 'traits')
				|| !getStatProfile(getGenerationStatProfileId(entry.generation))
			))
		) {
			errors.push(`Invalid routed background generator: ${background.id ?? 'unknown'}.`);
		}
		backgroundIds.add(background.id);
	}
	if (backgrounds.length === 0) {
		errors.push('Background routing must expose at least one category.');
	}
}
function checkCategoryRouters(errors, generatorCatalog) {
	for (const [routerId, childIds] of [
		['background', [
			'criminal',
			'adventurer',
			'noble',
			'peasant',
			'artisan',
			'merchant',
			'scholar',
			'religious',
			'military',
			'outlander',
			'sailor',
			'performer',
			'servant',
			'official',
			'mage',
			'exile',
			'urchin',
		]],
		['creature', ['animal', 'companion', 'monster']],
		['loot', [
			'weapons',
			'shields',
			'armors',
			'supplies',
			'consumable',
			'food_and_drink',
			'valuables',
			'material',
			'curio',
		]],
		['site', ['building', 'dungeon', 'settlement', 'region', 'room']],
		['group', ['government', 'faction', 'religion']],
		['modifier', [
			'modifier_character',
			'modifier_creature',
			'modifier_rarity',
			'modifier_material',
			'modifier_loot',
			'modifier_site_all',
			'modifier_site_building',
			'modifier_site_interiors',
			'modifier_site_structures',
		]],
	]) {
		const router = generatorCatalog.getGenerator(routerId);
		if (
			router?.visibility !== 'public'
			|| JSON.stringify(router.entrySchema.required) !== JSON.stringify([])
			|| router.entries.some(entry => (
				!entry.name
					|| Object.keys(entry).some(key => (
						!['id', 'name', 'weight', 'generator'].includes(key)
					))
			))
			|| JSON.stringify(router.entries.map(entry => entry.generator))
				!== JSON.stringify(childIds)
			|| router.entries.some(entry => (
				generatorCatalog.getGenerator(entry.generator)?.visibility !== 'internal'
			))
		) {
			errors.push(`Invalid public ${routerId} category router.`);
		}
	}
}

function checkPhysicalDescriptionGenerator(errors, generatorCatalog) {
	const generator = generatorCatalog.getGenerator('physical_description');
	if (
		!generator
		|| generator.visibility !== 'internal'
		|| JSON.stringify(generator.entrySchema.required) !== JSON.stringify(['description'])
		|| generator.entries.length < 20
		|| generator.entries.some(entry => (
			typeof entry.name !== 'string'
			|| typeof entry.fields?.description !== 'string'
		))
	) {
		errors.push('Physical descriptions must be a reusable internal descriptive generator.');
	}
}

function checkCreatureGenerators(errors, generatorCatalog) {
	const creature = generatorCatalog.getGenerator('creature');
	if (
		creature?.visibility !== 'public'
		|| !Array.isArray(creature?.entries)
		|| creature.entries.length === 0
	) {
		errors.push('The public creature router does not expose any valid creature types.');
	}
	for (const route of creature?.entries ?? []) {
		const generatorId = route.generator;
		const generator = generatorCatalog.getGenerator(generatorId);
		if (
			!generatorId
			|| generatorId !== route.id
			|| !generator
			|| generator.visibility !== 'internal'
			|| generator.entries.some(entry => (
				Object.hasOwn(entry.generation ?? {}, 'talents')
			))
		) {
			errors.push(`Invalid routed creature generator: ${generatorId}.`);
		}
	}
	const statusEffects = generatorCatalog.getGenerator('status_effect');
	const characterModifiers = generatorCatalog.getGenerator('modifier_character');
	const creatureModifiers = generatorCatalog.getGenerator('modifier_creature');
	if (
		!statusEffects
		|| statusEffects.entries.some(entry => (
			!entry.name || !entry.fields?.description
		))
		|| [characterModifiers, creatureModifiers].some(generator => (
			generator?.visibility !== 'internal'
			|| generator.entries.some(entry => (
				!entry.name || !entry.fields?.description
			))
		))
		|| JSON.stringify(generatorCatalog.getGenerator('region').modifiers)
			!== JSON.stringify({ modifier_site_all: 5 })
		|| JSON.stringify(generatorCatalog.getGenerator('building').modifiers)
			!== JSON.stringify({
				modifier_site_all: 5,
				modifier_site_structures: 5,
				modifier_site_interiors: 5,
				modifier_site_building: 5,
			})
	) {
		errors.push('Status effects and character/creature modifiers are not valid generation catalogs.');
	}
}

function checkStructuredGenerators(errors, generatorCatalog) {
	for (const [generatorId, requiredFields] of [
		['faction', ['type', 'goal', 'resources', 'hierarchy', 'allies', 'enemies']],
		['government', ['structure', 'leadership', 'strength', 'tension']],
		[
			'religion',
			[
				'deity_or_belief',
				'rites',
				'commandment',
				'taboo',
				'sacred_symbol',
				'religious_order',
				'holy_place',
				'relationship_with_magic',
			],
		],
	]) {
		const generator = generatorCatalog.getGenerator(generatorId);
		if (
			JSON.stringify(generator?.entrySchema.required)
				!== JSON.stringify(requiredFields)
			|| generator.entries.some(entry => (
				!entry.name || requiredFields.some(field => !entry.fields?.[field])
			))
		) {
			errors.push(`Generator ${generatorId} is missing required fields.`);
		}
	}

	const armorGenerator = generatorCatalog.getGenerator('armors');
	const armors = armorGenerator?.entries ?? [];
	if (
		JSON.stringify(armorGenerator?.entrySchema.required)
			!== JSON.stringify(['type', 'description'])
		|| armors.length !== 16
		|| [['light', 5], ['medium', 6], ['heavy', 5]].some(([type, count]) => (
			armors.filter(entry => entry.fields.type === type).length !== count
		))
		|| armors.some(entry => (
			Object.hasOwn(entry.fields, 'rarity')
			|| Object.hasOwn(entry.fields, 'constitution_requirement')
			|| Object.hasOwn(entry.fields, 'ar_percentage')
		))
	) {
		errors.push('The armor generator must contain independent typed armor forms.');
	}
	const shields = generatorCatalog.getGenerator('shields');
	const requiredShieldIds = [
		'buckler',
		'round_shield',
		'kite_shield',
		'heater_shield',
		'targe',
		'tower_shield',
		'pavise',
		'dueling_shield',
		'folding_shield',
		'mirrored_shield',
		'guardian_shield',
		'stormward_shield',
		'eclipse_shield',
		'oathkeeper_shield',
	];
	if (
		JSON.stringify(shields?.entrySchema) !== JSON.stringify({
			required: ['description'],
		})
		|| shields.entries.length !== requiredShieldIds.length
		|| requiredShieldIds.some(id => !shields.entries.some(entry => entry.id === id))
		|| shields.entries.some(entry => (
			Object.hasOwn(entry.fields, 'rarity')
			|| Object.hasOwn(entry.fields, 'ar_percentage')
		))
	) {
		errors.push('The shield generator must contain independent shield forms.');
	}
	const equipmentModifiers = JSON.stringify({
		modifier_rarity: 100,
		modifier_material: 15,
		modifier_loot: 10,
	});
	const rarityWeights = generatorCatalog.getGenerator('modifier_rarity')?.entries
		.map(entry => [entry.id, entry.weight]);
	const lootWeights = generatorCatalog.getGenerator('modifier_loot')?.entries
		.map(entry => [entry.id, entry.weight]);
	if (
		['weapons', 'shields', 'armors'].some(id => (
			JSON.stringify(generatorCatalog.getGenerator(id)?.modifiers)
			!== equipmentModifiers
		))
		|| JSON.stringify(rarityWeights) !== JSON.stringify([
			['common', 8],
			['uncommon', 5],
			['rare', 3],
			['epic', 2],
			['legendary', 1],
		])
		|| JSON.stringify(lootWeights) !== JSON.stringify([
			['runed', 6],
			['damaged', 6],
			['ancient', 6],
			['cursed_affliction', 3],
			['cursed_status_effect', 3],
			['possessed_animal', 2],
			['possessed_companion', 2],
			['possessed_monster', 2],
			['faction_made', 6],
		])
	) {
		errors.push('Loot modifier relationships or weights are invalid.');
	}
	const affliction = generatorCatalog.getGenerator('affliction');
	if (
		JSON.stringify(affliction?.entrySchema) !== JSON.stringify({
			required: ['type', 'description'],
		})
		|| affliction.entries.length !== 16
		|| ['disease', 'curse'].some(type => (
			affliction.entries.filter(entry => entry.fields.type === type).length !== 8
		))
	) {
		errors.push('The affliction generator must contain eight diseases and eight curses.');
	}
	const races = generatorCatalog.getGenerator('race')?.entries ?? [];
	const raceIds = new Set(races.map(entry => entry.id));
	if (
		['human', 'elf', 'dwarf', 'orc', 'goblin'].some(id => !raceIds.has(id))
		|| races.some(entry => (
			!entry.fields.description
			|| !entry.fields.skill_bonus
			|| !entry.fields.physical_ability
		))
	) {
		errors.push('Race entries must expose stable IDs, descriptions, and racial traits.');
	}
}

function checkGeneratorResponses(errors, generatorCatalog, weightedEntries) {
	const generatedName = generatorResolver.generate('name', 'en', { random: () => 0 });
	if (!generatedName?.fields?.first_name || !generatedName.fields.last_name) {
		errors.push('Name generators should expose separate first_name and last_name fields.');
	}
	const rulesResult = generatorResolver.generate('rules', 'en', { random: () => 0 });
	if (!rulesResult?.fields?.name || !rulesResult.fields.description) {
		errors.push('RULE generators should expose separate name and description fields.');
	}

	const { createGeneratedEmbed } = require('../../util/generatorResponses');
	const structuredEmbed = createGeneratedEmbed(rulesResult).toJSON();
	if (
		structuredEmbed.fields?.[0]?.name !== 'Name'
		|| structuredEmbed.fields?.[1]?.name !== 'Description'
	) {
		errors.push('Structured generator fields are not rendered correctly.');
	}
	const weightedTextEmbed = createGeneratedEmbed({
		generatorName: 'test',
		outputType: 'value',
		value: weightedEntries[1].name,
		modifiers: [],
	}).toJSON();
	if (weightedTextEmbed.description !== 'Double weight') {
		errors.push('Weighted name-only generator entries are not rendered correctly.');
	}
}

function checkStatProfiles(errors) {
	const profiles = listStatProfiles();
	const defaultProfile = getStatProfile(DEFAULT_STAT_PROFILE_ID);
	if (
		profiles.length === 0
		|| profiles.filter(profile => profile.id === DEFAULT_STAT_PROFILE_ID).length !== 1
		|| defaultProfile !== getStatProfile(DEFAULT_STAT_PROFILE_ID)
	) {
		errors.push('The default statistical profile is missing or is not cached.');
	}
}

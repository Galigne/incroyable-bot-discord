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
	ARMOR_PERCENTAGES,
	SHIELD_PERCENTAGES,
} = require('../../services/mechanics/armor');
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

			const pairedGeneratorId = publicGenerators[0]?.id;
			const englishGenerator = generatorCatalog.getGenerator(pairedGeneratorId, 'en');
			const frenchGenerator = generatorCatalog.getGenerator(pairedGeneratorId, 'fr');
			if (
				!pairedGeneratorId
				|| englishGenerator === frenchGenerator
				|| englishGenerator?.id !== pairedGeneratorId
				|| frenchGenerator?.id !== pairedGeneratorId
				|| JSON.stringify(englishGenerator?.entries.map(entry => entry.id))
					!== JSON.stringify(frenchGenerator?.entries.map(entry => entry.id))
				|| generatorCatalog.getGenerator(pairedGeneratorId, 'fr') !== frenchGenerator
			) {
				errors.push('Generator catalogs are not paired and cached by stable ID.');
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
		'aspect',
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
	for (const routerId of [
		'background',
		'creature',
		'loot',
		'site',
		'group',
		'modifier',
		'aspect',
	]) {
		const router = generatorCatalog.getGenerator(routerId);
		if (
			router?.visibility !== 'public'
			|| !Array.isArray(router.entries)
			|| router.entries.length === 0
			|| JSON.stringify(router.entrySchema.required) !== JSON.stringify([])
			|| router.entries.some(entry => (
				!entry.name
					|| Object.keys(entry).some(key => (
						!['id', 'name', 'weight', 'generator'].includes(key)
					))
			))
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
				!entry.name
					|| !entry.fields?.description
					|| Object.hasOwn(entry.generation ?? {}, 'talents')
					|| !getStatProfile(getGenerationStatProfileId(entry.generation))
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
	) {
		errors.push('Status effects and character/creature modifiers are not valid generation catalogs.');
	}
}

function checkStructuredGenerators(errors, generatorCatalog) {
	const armorGenerator = generatorCatalog.getGenerator('armors');
	const armors = armorGenerator?.entries ?? [];
	const armorTypes = Object.keys(ARMOR_PERCENTAGES);
	if (
		JSON.stringify(armorGenerator?.entrySchema.required)
			!== JSON.stringify(['type', 'description'])
		|| armors.length === 0
		|| armors.some(entry => (
			!armorTypes.includes(entry.fields.type)
			|| Object.hasOwn(entry.fields, 'rarity')
			|| Object.hasOwn(entry.fields, 'constitution_requirement')
			|| Object.hasOwn(entry.fields, 'ar_percentage')
		))
	) {
		errors.push('The armor generator must contain independent typed armor forms.');
	}
	const shields = generatorCatalog.getGenerator('shields');
	if (
		JSON.stringify(shields?.entrySchema) !== JSON.stringify({
			required: ['description'],
		})
		|| shields.entries.length === 0
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
	const rarityIds = generatorCatalog.getGenerator('modifier_rarity')?.entries
		.map(entry => entry.id);
	const mechanicalRarityIds = Object.keys(SHIELD_PERCENTAGES);
	if (
		['weapons', 'shields', 'armors'].some(id => (
			JSON.stringify(generatorCatalog.getGenerator(id)?.modifiers)
			!== equipmentModifiers
		))
		|| JSON.stringify([...rarityIds].sort())
			!== JSON.stringify([...mechanicalRarityIds].sort())
		|| Object.values(ARMOR_PERCENTAGES).some(percentages => (
			JSON.stringify(Object.keys(percentages))
				!== JSON.stringify(mechanicalRarityIds)
		))
	) {
		errors.push('Loot modifier relationships or mechanical rarity IDs are invalid.');
	}
	const affliction = generatorCatalog.getGenerator('affliction');
	if (
		JSON.stringify(affliction?.entrySchema) !== JSON.stringify({
			required: ['type', 'description'],
		})
		|| affliction.entries.length === 0
		|| affliction.entries.some(entry => (
			!['disease', 'curse'].includes(entry.fields.type)
		))
		|| new Set(affliction.entries.map(entry => entry.fields.type)).size !== 2
	) {
		errors.push('Afflictions must expose localized disease and curse classifications.');
	}
	const races = generatorCatalog.getGenerator('race')?.entries ?? [];
	if (
		races.length === 0
		|| races.some(entry => (
			!entry.fields.description
			|| !entry.fields.skill_bonus
			|| !entry.fields.physical_ability
		))
	) {
		errors.push('Race entries must expose descriptions and racial traits.');
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

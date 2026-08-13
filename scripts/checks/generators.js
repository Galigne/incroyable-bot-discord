const {
	getStatProfile,
	listStatProfiles,
} = require('../../services/statProfileCatalog');
const {
	getEntryWeight,
	selectWeightedEntry,
} = require('../../services/weightedSelector');
const {
	parseWrappedInlineReference,
} = require('../../services/generatorSchema/referenceValidation');
const generatorResolver = require('../../services/generatorResolver');

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
				errors.push('Generator v3 visibility or schema filtering is incorrect.');
			}

			const englishRace = generatorCatalog.getGenerator('race', 'en');
			const frenchRace = generatorCatalog.getGenerator('race', 'fr');
			if (
				englishRace === frenchRace
				|| englishRace?.id !== 'race'
				|| frenchRace?.id !== 'race'
				|| englishRace?.entries[0]?.id !== 'human'
				|| frenchRace?.entries[0]?.id !== 'human'
				|| englishRace?.entries[0]?.fields?.name !== 'Human'
				|| frenchRace?.entries[0]?.fields?.name !== 'Humain'
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
				{ id: 'default-weight', value: 'Default weight' },
				{ id: 'double-weight', value: 'Double weight', weight: 2 },
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
		'armors',
		'background',
		'building',
		'creature',
		'dungeon',
		'event',
		'faction',
		'government',
		'inventory',
		'material',
		'name',
		'personality',
		'quest',
		'race',
		'region',
		'religion',
		'room',
		'rules',
		'settlement',
		'status_effect',
		'talents',
		'trap',
		'weapons',
	];
	const publicIds = new Set(
		generatorCatalog.listGenerators('en').map(generator => generator.id),
	);
	for (const generatorId of requiredPublicGenerators) {
		if (!publicIds.has(generatorId)) {
			errors.push(`Missing public generator: ${generatorId}.`);
		}
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
		const routedGeneratorId = getInlineGeneratorId(background.fields?.generator);
		const details = generatorCatalog.getGenerator(routedGeneratorId)?.entries ?? [];
		if (
			!background.id
			|| !background.fields?.name
			|| !background.fields?.description
			|| backgroundIds.has(background.id)
			|| routedGeneratorId !== `background_${background.id}`
			|| details.length === 0
			|| generatorCatalog.getGenerator(routedGeneratorId)?.entrySchema.type !== 'text'
			|| details.some(entry => typeof entry.value !== 'string' || !entry.value.trim())
		) {
			errors.push(`Invalid routed background generator: ${background.id ?? 'unknown'}.`);
		}
		backgroundIds.add(background.id);
	}
	if (backgrounds.length === 0) {
		errors.push('Background routing must expose at least one category.');
	}
}

function checkPhysicalDescriptionGenerator(errors, generatorCatalog) {
	const generator = generatorCatalog.getGenerator('physical_description');
	if (
		!generator
		|| generator.visibility !== 'internal'
		|| generator.entrySchema.type !== 'text'
		|| generator.entries.length < 20
		|| generator.entries.some(entry => typeof entry.value !== 'string' || !entry.value.trim())
	) {
		errors.push('Physical descriptions must be a reusable internal text generator.');
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
		const generatorId = getInlineGeneratorId(route.fields?.generator);
		const generator = generatorCatalog.getGenerator(generatorId);
		if (
			!generatorId
			|| !generator
			|| generator.visibility !== 'internal'
			|| generator.entries.some(entry => !entry.generation)
		) {
			errors.push(`Invalid routed creature generator: ${generatorId}.`);
		}
	}
	const statusEffects = generatorCatalog.getGenerator('status_effect');
	const characterModifiers = generatorCatalog.getGenerator('modifier_character');
	const creatureModifiers = generatorCatalog.getGenerator('modifier_creature');
	if (
		statusEffects?.entrySchema.type !== 'fields'
		|| statusEffects.entries.some(entry => (
			!entry.fields?.name || !entry.fields.description
		))
		|| [characterModifiers, creatureModifiers].some(generator => (
			generator?.visibility !== 'internal'
			|| generator.entrySchema.type !== 'fields'
			|| generator.entries.some(entry => (
				!entry.fields?.name || !entry.fields.description
			))
		))
		|| JSON.stringify(generatorCatalog.getGenerator('region').modifiers)
			!== JSON.stringify({ site_modifier_all: 20 })
		|| JSON.stringify(generatorCatalog.getGenerator('building').modifiers)
			!== JSON.stringify({
				site_modifier_all: 20,
				site_modifier_structures: 20,
				site_modifier_interiors: 20,
				site_modifier_building: 20,
			})
	) {
		errors.push('Status effects and character/creature modifiers are not valid generation catalogs.');
	}
}

function checkStructuredGenerators(errors, generatorCatalog) {
	for (const [generatorId, requiredFields] of [
		['faction', ['name', 'type', 'goal', 'resources', 'hierarchy', 'allies', 'enemies']],
		['government', ['name', 'structure', 'leadership', 'strength', 'tension']],
		[
			'religion',
			[
				'name',
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
			|| generator.entries.some(entry => requiredFields.some(field => !entry.fields?.[field]))
		) {
			errors.push(`Generator ${generatorId} is missing required fields.`);
		}
	}

	const armors = generatorCatalog.getGenerator('armors')?.entries ?? [];
	const armorCombinations = new Set(armors.map(
		entry => `${entry.fields.type}:${entry.fields.rarity}`,
	));
	const expectedArmorCombinations = ['light', 'medium', 'heavy']
		.flatMap(type => ['common', 'uncommon', 'rare', 'epic', 'legendary']
			.map(rarity => `${type}:${rarity}`));
	if (
		armors.length !== 15
		|| expectedArmorCombinations.some(value => !armorCombinations.has(value))
	) {
		errors.push('The armor generator must contain every type and rarity combination.');
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
		value: weightedEntries[1].value,
		modifiers: [],
	}).toJSON();
	if (weightedTextEmbed.description !== 'Double weight') {
		errors.push('Weighted text generator entries are not rendered correctly.');
	}
}

function checkStatProfiles(errors) {
	const profiles = listStatProfiles();
	const balanced = getStatProfile('character-balanced');
	if (
		profiles.length === 0
		|| profiles.filter(profile => profile.id === 'character-balanced').length !== 1
		|| balanced !== getStatProfile('character-balanced')
	) {
		errors.push('The balanced statistical profile is missing or is not cached.');
	}
}

function getInlineGeneratorId(value) {
	try {
		const reference = parseWrappedInlineReference(value, 'generator check');
		return reference.entry || reference.field ? undefined : reference.generator;
	}
	catch {
		return undefined;
	}
}

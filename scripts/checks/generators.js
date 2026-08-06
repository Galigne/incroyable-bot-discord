const fs = require('node:fs');
const path = require('node:path');
const {
	getStatProfile,
	listStatProfiles,
} = require('../../services/statProfileCatalog');
const {
	getEntryWeight,
	selectWeightedEntry,
} = require('../../services/weightedSelector');
const generatorResolver = require('../../services/generatorResolver');

module.exports = function createGeneratorChecks(context) {
	const {
		errors,
		generatorCatalog,
	} = context;

	function checkGeneratorCatalog() {
		try {
			checkProductionDataIsV2(errors);
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
				|| internalGenerators.some(generator => !(
					(generator.id.startsWith('background-') && generator.kind === 'component')
					|| (
						['creature-animal', 'creature-companion', 'creature-monster']
							.includes(generator.id)
						&& generator.kind === 'component'
					)
					|| (
						(
							generator.id === 'modifier'
							|| generator.id.startsWith('site-modifier-')
						)
						&& generator.kind === 'modifier'
					)
				))
			) {
				errors.push('Generator v2 visibility or kind filtering is incorrect.');
			}

			const englishRace = generatorCatalog.getGenerator('race', 'en');
			const frenchRace = generatorCatalog.getGenerator('race', 'fr');
			if (
				englishRace === frenchRace
				|| englishRace?.id !== 'race'
				|| frenchRace?.id !== 'race'
				|| englishRace?.entries[0]?.id !== 'human'
				|| frenchRace?.entries[0]?.id !== 'human'
				|| englishRace?.entries[0]?.fields?.Name !== 'Human'
				|| frenchRace?.entries[0]?.fields?.Name !== 'Humain'
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

function checkProductionDataIsV2(errors) {
	const generatorRoot = path.join(__dirname, '..', '..', 'data', 'generators');
	const englishFiles = listJsonFiles(path.join(generatorRoot, 'en'));
	const frenchFiles = listJsonFiles(path.join(generatorRoot, 'fr'));
	if (JSON.stringify(englishFiles) !== JSON.stringify(frenchFiles)) {
		errors.push('English and French generator directories must contain the same files.');
		return;
	}
	for (const file of englishFiles) {
		for (const locale of ['en', 'fr']) {
			const generator = JSON.parse(fs.readFileSync(
				path.join(generatorRoot, locale, file),
				'utf8',
			));
			if (
				generator.schemaVersion !== 2
				|| !generator.id
				|| !generator.kind
				|| !generator.visibility
				|| !generator.entrySchema
				|| generator.entries.some(entry => typeof entry === 'string' || !entry.id)
			) {
				errors.push(`Generator ${locale}/${file} was not fully converted to schema v2.`);
			}
		}
	}
}

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
		'status-effect',
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
		'creature-animal',
		'creature-companion',
		'creature-monster',
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
	for (const obsoleteId of [
		'loot',
		'power',
		'enemy',
		'location',
		'citizen-background',
		'npc',
		'criminal',
	]) {
		if (generatorCatalog.getGenerator(obsoleteId)) {
			errors.push(`Obsolete generator ${obsoleteId} still exists.`);
		}
	}
}

function checkBackgroundGenerators(errors, generatorCatalog) {
	const backgrounds = generatorCatalog.getGenerator('background')?.entries ?? [];
	const backgroundIds = new Set();
	for (const background of backgrounds) {
		const routedGeneratorId = background.fields?.Generator;
		const details = generatorCatalog.getGenerator(routedGeneratorId)?.entries ?? [];
		if (
			!background.id
			|| !background.fields?.Name
			|| !background.fields?.Description
			|| backgroundIds.has(background.id)
			|| !routedGeneratorId?.startsWith('background-')
			|| details.length === 0
			|| details.some(entry => (
				['Appearance', 'Backstory', 'Goals'].some(field => !entry.fields?.[field])
			))
		) {
			errors.push(`Invalid routed background generator: ${background.id ?? 'unknown'}.`);
		}
		backgroundIds.add(background.id);
	}
	if (
		backgrounds.length !== 17
		|| backgroundIds.has('citizen')
		|| generatorCatalog.getGenerator('background-citizen')
	) {
		errors.push('Background routing must contain the 17 supported non-citizen categories.');
	}
}

function checkCreatureGenerators(errors, generatorCatalog) {
	const creature = generatorCatalog.getGenerator('creature');
	const expectedRoutes = {
		animal: 'creature-animal',
		companion: 'creature-companion',
		monster: 'creature-monster',
	};
	if (
		creature?.kind !== 'category'
		|| creature.visibility !== 'public'
		|| Object.entries(expectedRoutes).some(([archetype, generatorId]) => (
			creature.entries.find(entry => entry.id === archetype)
				?.fields?.Generator !== generatorId
		))
	) {
		errors.push('The public creature router does not expose every creature type.');
	}
	for (const generatorId of Object.values(expectedRoutes)) {
		const generator = generatorCatalog.getGenerator(generatorId);
		if (
			generator?.kind !== 'component'
			|| generator.visibility !== 'internal'
			|| generator.entries.length < 20
			|| generator.entries.some(entry => !entry.generation)
		) {
			errors.push(`Invalid routed creature generator: ${generatorId}.`);
		}
	}
	const statusEffects = generatorCatalog.getGenerator('status-effect');
	const modifier = generatorCatalog.getGenerator('modifier');
	if (
		statusEffects?.entrySchema.type !== 'fields'
		|| statusEffects.entries.some(entry => (
			!entry.fields?.Name || !entry.fields.Description
		))
		|| modifier?.kind !== 'modifier'
		|| !modifier.appliesTo.includes('background')
		|| Object.values(expectedRoutes).some(id => !modifier.appliesTo.includes(id))
	) {
		errors.push('Status effects and modifiers are not shared generation catalogs.');
	}
}

function checkStructuredGenerators(errors, generatorCatalog) {
	for (const [generatorId, requiredFields] of [
		['faction', ['Name', 'Type', 'Goal', 'Resources', 'Hierarchy', 'Allies', 'Enemies']],
		['government', ['Name', 'Structure', 'Leadership', 'Strength', 'Tension']],
		[
			'religion',
			[
				'Name',
				'Deity or Belief',
				'Rites',
				'Commandment',
				'Taboo',
				'Sacred Symbol',
				'Religious Order',
				'Holy Place',
				'Relationship with Magic',
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
		entry => `${entry.fields.Type}:${entry.fields.Rarity}`,
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
	for (const generatorId of ['armors', 'weapons', 'inventory']) {
		const entries = generatorCatalog.getGenerator(generatorId)?.entries ?? [];
		if (entries.some(entry => Object.hasOwn(entry.fields ?? {}, 'Encumbrance'))) {
			errors.push(`Generator ${generatorId} still contains obsolete Encumbrance fields.`);
		}
	}

	const races = generatorCatalog.getGenerator('race')?.entries ?? [];
	const raceIds = new Set(races.map(entry => entry.id));
	if (
		['human', 'elf', 'dwarf', 'orc', 'goblin'].some(id => !raceIds.has(id))
		|| races.some(entry => (
			!entry.fields.Description
			|| !entry.fields['Skill Bonus']
			|| !entry.fields['Physical Ability']
		))
	) {
		errors.push('Race entries must expose stable IDs, descriptions, and racial traits.');
	}
}

function checkGeneratorResponses(errors, generatorCatalog, weightedEntries) {
	const generatedName = generatorResolver.generate('name', 'en', { random: () => 0 });
	if (!generatedName?.fields?.FirstName || !generatedName.fields.LastName) {
		errors.push('Name generators should expose separate FirstName and LastName fields.');
	}
	const rulesResult = generatorResolver.generate('rules', 'en', { random: () => 0 });
	if (!rulesResult?.fields?.Name || !rulesResult.fields.Description) {
		errors.push('RULE generators should expose separate Name and Description fields.');
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

function listJsonFiles(directory, relativeDirectory = '') {
	const files = [];
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		const relativePath = path.join(relativeDirectory, entry.name);
		const absolutePath = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...listJsonFiles(absolutePath, relativePath));
		}
		else if (entry.isFile() && entry.name.endsWith('.json')) {
			files.push(relativePath);
		}
	}
	return files.sort();
}

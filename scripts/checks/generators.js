const fs = require('node:fs');
const path = require('node:path');

module.exports = function createGeneratorChecks(context) {
	const {
		errors,
		generatorCatalog,
	} = context;

	function checkGeneratorCatalog() {
		try {
			checkLocalizedGeneratorFiles(errors, generatorCatalog);
			const categories = generatorCatalog.listCategories();
			if (categories.length === 0) {
				errors.push('At least one generator category is required.');
			}
			const englishRace = generatorCatalog.getGenerator('race', 'en');
			const frenchRace = generatorCatalog.getGenerator('race', 'fr');
			if (
				englishRace === frenchRace
				|| englishRace?.id !== 'race'
				|| frenchRace?.id !== 'race'
				|| englishRace?.entries[0]?.fields?.Name !== 'Human'
				|| frenchRace?.entries[0]?.fields?.Name !== 'Humain'
				|| generatorCatalog.getGenerator('race', 'fr') !== frenchRace
			) {
				errors.push('Generator catalogs are not localized and cached independently.');
			}

			for (const category of categories) {
				const firstResult = generatorCatalog.generate(category.name, () => 0);
				if (firstResult?.entry !== category.entries[0]) {
					errors.push(`Generator category ${category.name} cannot select its first prompt.`);
				}
			}

			if (
				generatorCatalog.getCategory('personality')
				&& generatorCatalog.getCategory('personalities')?.key !== 'personality'
			) {
				errors.push('Plural generator category names are not normalized correctly.');
			}

			const weightedEntries = [
				'Default weight',
				{ value: 'Double weight', weight: 2 },
			];
			if (
				generatorCatalog.getEntryWeight(weightedEntries[0]) !== 1
				|| generatorCatalog.getEntryWeight(weightedEntries[1]) !== 2
				|| generatorCatalog.selectWeightedEntry(weightedEntries, () => 0) !== weightedEntries[0]
				|| generatorCatalog.selectWeightedEntry(weightedEntries, () => 0.5) !== weightedEntries[1]
			) {
				errors.push('Weighted generator selection is not working correctly.');
			}

			const requiredCategories = [
				'animal',
				'armors',
				'background',
				'building',
				'companion',
				'criminal',
				'dungeon',
				'event',
				'faction',
				'government',
				'inventory',
				'material',
				'monster',
				'name',
				'npc',
				'personality',
				'quest',
				'race',
				'region',
				'religion',
				'room',
				'rules',
				'settlement',
				'statusEffect',
				'talents',
				'trap',
				'weapons',
			];
			for (const categoryName of requiredCategories) {
				if (!generatorCatalog.getCategory(categoryName)) {
					errors.push(`Missing generator category: ${categoryName}.`);
				}
			}
			const expandedGeneratorCategories = [
				'animal',
				'building',
				'companion',
				'criminal',
				'dungeon',
				'faction',
				'government',
				'material',
				'monster',
				'region',
				'religion',
				'room',
				'settlement',
			];
			for (const categoryName of expandedGeneratorCategories) {
				const entryCount = generatorCatalog.getCategory(categoryName)?.entries.length ?? 0;
				if (entryCount < 20 || entryCount > 40) {
					errors.push(
						`Generator category ${categoryName} must contain 20 to 40 entries.`,
					);
				}
			}
			const backgroundEntries = generatorCatalog.getCategory('background')?.entries ?? [];
			const backgroundNames = new Set();
			for (const background of backgroundEntries) {
				const backgroundName = background.fields?.Name;
				const generatorName = background.fields?.Generator;
				const details = generatorCatalog.getCategory(generatorName)?.entries ?? [];
				if (
					!backgroundName
					|| !background.fields?.Description
					|| !generatorName
					|| backgroundNames.has(backgroundName.toLowerCase())
					|| details.length === 0
					|| details.some(entry => (
						['Appearance', 'Backstory', 'Goals']
							.some(field => !entry.fields?.[field])
					))
				) {
					errors.push(`Invalid routed background generator: ${backgroundName ?? 'unknown'}.`);
				}
				backgroundNames.add(backgroundName?.toLowerCase());
			}
			if (
				backgroundEntries.length !== 17
				|| backgroundNames.has('citizen')
				|| generatorCatalog.getCategory('citizenBackground')
			) {
				errors.push('Background routing must contain the 17 supported non-citizen categories.');
			}

			for (const [categoryName, requiredFields] of [
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
				const entries = generatorCatalog.getCategory(categoryName)?.entries ?? [];
				if (entries.some(entry => requiredFields.some(field => !entry.fields?.[field]))) {
					errors.push(`Generator category ${categoryName} is missing required fields.`);
				}
			}
			if (
				generatorCatalog.getCategory('loot')
				|| generatorCatalog.getCategory('power')
				|| generatorCatalog.getCategory('enemy')
				|| generatorCatalog.getCategory('location')
				|| generatorCatalog.getCategory('citizenBackground')
			) {
				errors.push('An obsolete generator category still exists.');
			}
			const armors = generatorCatalog.getCategory('armors')?.entries ?? [];
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
			const races = generatorCatalog.getCategory('race')?.entries ?? [];
			const commonRaceNames = ['Human', 'Elf', 'Dwarf', 'Orc', 'Goblin'];
			const raceNames = new Set(races.map(entry => entry.fields.Name));
			if (
				commonRaceNames.some(name => !raceNames.has(name))
				|| races.some(entry => (
					!entry.fields.Description
					|| !entry.fields['Skill Bonus']
					|| !entry.fields['Physical Ability']
				))
			) {
				errors.push('Race entries must expose names, descriptions, and racial traits.');
			}
			const generatedName = generatorCatalog.generate('name', () => 0)?.entry;
			if (!generatedName?.fields?.FirstName || !generatedName.fields.LastName) {
				errors.push('Name generators should expose separate FirstName and LastName fields.');
			}

			const rulesResult = generatorCatalog.generate('rules', () => 0);
			if (
				!rulesResult?.entry?.fields?.Name
				|| !rulesResult.entry.fields.Description
			) {
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
				category: { name: 'test' },
				entry: weightedEntries[1],
			}).toJSON();
			if (weightedTextEmbed.description !== 'Double weight') {
				errors.push('Weighted text generator entries are not rendered correctly.');
			}
		}
		catch (error) {
			errors.push(`Generator catalog: ${error.message}`);
		}
	}

	async function checkGenHelp() {
		try {
			const genHelp = require('../../commands/rpg/subcommands/genhelp');
			let response;
			await genHelp.execute({
				interaction: {
					reply: async payload => {
						response = payload;
					},
				},
			});
			const embed = response?.embeds?.[0]?.toJSON();
			const renderedHelp = JSON.stringify(embed);
			const missingCategory = generatorCatalog.listCategories()
				.find(category => !renderedHelp.includes(category.name));
			if (
				!embed
				|| !renderedHelp.includes('/rpg gen category:<category>')
				|| !renderedHelp.includes(
					'/rpg gen-char character-key:<new key> [level] [background]',
				)
				|| !renderedHelp.includes('maximum of two RULEs')
				|| missingCategory
				|| embed.fields?.some(field => field.value.length > 1_024)
			) {
				errors.push('/rpg gen-help is incomplete or exceeds Discord embed limits.');
			}
		}
		catch (error) {
			errors.push(`Gen help: ${error.message}`);
		}
	}

	return {
		checkGeneratorCatalog,
		checkGenHelp,
	};
};

function checkLocalizedGeneratorFiles(errors, generatorCatalog) {
	const generatorRoot = path.join(__dirname, '..', '..', 'data', 'generators');
	const englishDirectory = path.join(generatorRoot, 'en');
	const frenchDirectory = path.join(generatorRoot, 'fr');
	const englishFiles = listJsonFiles(englishDirectory);
	const frenchFiles = listJsonFiles(frenchDirectory);

	if (JSON.stringify(englishFiles) !== JSON.stringify(frenchFiles)) {
		errors.push('English and French generator directories must contain the same JSON files.');
		return;
	}

	for (const file of englishFiles) {
		try {
			const english = JSON.parse(fs.readFileSync(path.join(englishDirectory, file), 'utf8'));
			const french = JSON.parse(fs.readFileSync(path.join(frenchDirectory, file), 'utf8'));
			compareLocalizedShape(english, french, file, [], errors);
		}
		catch (error) {
			errors.push(`Invalid localized generator JSON ${file}: ${error.message}`);
		}
	}

	const englishIds = generatorCatalog.listGenerators('en').map(generator => generator.id).sort();
	const frenchIds = generatorCatalog.listGenerators('fr').map(generator => generator.id).sort();
	if (JSON.stringify(englishIds) !== JSON.stringify(frenchIds)) {
		errors.push('English and French generator catalogs must expose the same internal IDs.');
	}
	const englishFallbackPath = path.join(englishDirectory, englishFiles[0]);
	const missingLocalizedPath = path.join(frenchDirectory, '__missing-generator__.json');
	if (
		generatorCatalog.selectLocalizedGeneratorPath(
			englishFallbackPath,
			missingLocalizedPath,
			'fr',
		) !== englishFallbackPath
	) {
		errors.push('A missing localized generator must fall back to its English file.');
	}
}

function listJsonFiles(directory) {
	return fs.readdirSync(directory)
		.filter(file => file.endsWith('.json'))
		.sort();
}

function compareLocalizedShape(english, french, file, propertyPath, errors) {
	const location = `${file}:${propertyPath.join('.') || '<root>'}`;
	if (Array.isArray(english)) {
		if (!Array.isArray(french) || english.length !== french.length) {
			errors.push(`Localized generator arrays differ at ${location}.`);
			return;
		}
		english.forEach((value, index) => compareLocalizedShape(
			value,
			french[index],
			file,
			[...propertyPath, index],
			errors,
		));
		return;
	}
	if (english && typeof english === 'object') {
		if (!french || typeof french !== 'object' || Array.isArray(french)) {
			errors.push(`Localized generator structures differ at ${location}.`);
			return;
		}
		const englishKeys = Object.keys(english);
		const frenchKeys = Object.keys(french);
		if (JSON.stringify(englishKeys) !== JSON.stringify(frenchKeys)) {
			errors.push(`Localized generator keys differ at ${location}.`);
			return;
		}
		for (const key of englishKeys) {
			compareLocalizedShape(
				english[key],
				french[key],
				file,
				[...propertyPath, key],
				errors,
			);
		}
		return;
	}

	if (typeof english !== typeof french) {
		errors.push(`Localized generator value types differ at ${location}.`);
		return;
	}
	const property = propertyPath.at(-1);
	if (
		['weight', 'Generator', 'Type', 'Rarity', 'AR percentage',
			'Constitution requirement', 'Encumbrance', 'FirstName', 'LastName']
			.includes(property)
		&& english !== french
	) {
		errors.push(`Technical generator value was translated at ${location}.`);
	}
	if (
		typeof english === 'string'
		&& JSON.stringify(extractPlaceholders(english))
			!== JSON.stringify(extractPlaceholders(french))
	) {
		errors.push(`Localized generator placeholders differ at ${location}.`);
	}
}

function extractPlaceholders(value) {
	return [
		...value.matchAll(/\{\{[^{}]+\}\}|\$\{[^{}]+\}|%\w/g),
	].map(match => match[0]).sort();
}

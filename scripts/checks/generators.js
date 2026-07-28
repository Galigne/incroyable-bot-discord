module.exports = function createGeneratorChecks(context) {
	const {
		errors,
		generatorCatalog,
	} = context;

	function checkGeneratorCatalog() {
		try {
			const categories = generatorCatalog.listCategories();
			if (categories.length === 0) {
				errors.push('At least one generator category is required.');
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
			const genCommand = require('../../commands/rpg/subcommands/gen');
			const structuredEmbed = genCommand.createGeneratedEmbed(rulesResult).toJSON();
			if (
				structuredEmbed.fields?.[0]?.name !== 'Name'
				|| structuredEmbed.fields?.[1]?.name !== 'Description'
			) {
				errors.push('Structured generator fields are not rendered correctly.');
			}
			const weightedTextEmbed = genCommand.createGeneratedEmbed({
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


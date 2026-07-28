const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ffmpegPath = require('ffmpeg-static');
const { generateDependencyReport } = require('@discordjs/voice');
const Character = require('../models/Character');
const { BASE_STATS: BASE_STAT_NAMES } = Character;
const config = require('../config.json');
const root = path.join(__dirname, '..');
const testSavesDirectory = fs.mkdtempSync(
	path.join(os.tmpdir(), 'incredible-bot-check-'),
);
process.env.INCREDIBLE_BOT_SAVE_DIRECTORY = testSavesDirectory;
const characterStore = require('../services/characterStore');
const {
	dealDamage,
	getEditableFieldValue,
	resetTurnResources,
	restoreResource,
	setEditableFieldValue,
} = require('../services/characterEditor');
const generatorCatalog = require('../services/generatorCatalog');
const {
	allocateRuleLevels,
	calculateMaxAp,
	calculateRulePoints,
	calculateStatBudget,
	calculateStatCost,
	populateRandomCharacter,
} = require('../services/randomCharacterGenerator');
const { authorizeCommand } = require('../util/authorization');
const { loadCommands } = require('../util/loadCommands');

const errors = [];

async function main() {
	try {
		checkNodeVersion();
		checkJavaScriptSyntax();
		checkDeprecatedInteractionOptions();
		const commands = checkCommands();
		checkHelpOrder(commands.values(), 'top-level commands');
		checkRpgStructure(commands);
		checkSlashCommandData(commands);
		checkGeneratorCatalog();
		await checkGenHelp();
		checkCharacterModel();
		checkRandomCharacterGeneration();
		await checkCharacterStore();
		await checkInteractiveRpgUx();
		checkConfiguration();
		checkAuthorization(commands);
		checkRequiredFiles();

		if (errors.length > 0) {
			console.error(errors.join('\n\n'));
			process.exitCode = 1;
		}
		else {
			console.log(`Checks passed: ${commands.size} commands loaded.`);
			console.log(generateDependencyReport());
		}
	}
	finally {
		const resolvedTemporaryDirectory = path.resolve(testSavesDirectory);
		const resolvedSystemTemporaryDirectory = path.resolve(os.tmpdir());
		if (
			resolvedTemporaryDirectory.startsWith(
				`${resolvedSystemTemporaryDirectory}${path.sep}`,
			)
			&& path.basename(resolvedTemporaryDirectory).startsWith('incredible-bot-check-')
		) {
			fs.rmSync(resolvedTemporaryDirectory, { recursive: true, force: true });
		}
	}
}

function checkNodeVersion() {
	const [major, minor] = process.versions.node.split('.').map(Number);
	if (major < 22 || (major === 22 && minor < 12)) {
		errors.push(`Node.js ${process.versions.node} is too old. Version 22.12.0 or newer is required.`);
	}
}

function checkJavaScriptSyntax() {
	for (const file of findJavaScriptFiles(root)) {
		const result = spawnSync(process.execPath, ['--check', file], {
			encoding: 'utf8',
		});
		if (result.status !== 0) {
			errors.push(`${path.relative(root, file)}: ${result.stderr.trim()}`);
		}
	}
}

function checkDeprecatedInteractionOptions() {
	for (const file of findJavaScriptFiles(root)) {
		const source = fs.readFileSync(file, 'utf8');
		if (/\bephemeral\s*:/.test(source)) {
			errors.push(
				`${path.relative(root, file)} uses the deprecated ephemeral response option.`,
			);
		}
	}
}

function checkCommands() {
	try {
		return loadCommands(path.join(root, 'commands'));
	}
	catch (error) {
		errors.push(error.stack);
		return new Map();
	}
}

function checkRpgStructure(commands) {
	const rpgCommand = commands.get('rpg');
	if (!rpgCommand?.subcommands) {
		errors.push('The RPG command must expose its subcommands.');
		return;
	}

	const expectedSubcommands = [
		'add',
		'damage',
		'delete',
		'end-turn',
		'gen',
		'gen-char',
		'gen-help',
		'get',
		'get-help',
		'heal',
		'help',
		'roll',
		'rules',
		'set',
		'set-help',
	];
	const actualSubcommands = [...rpgCommand.subcommands.keys()].sort();
	if (actualSubcommands.join(',') !== expectedSubcommands.join(',')) {
		errors.push(`Unexpected RPG subcommands: ${actualSubcommands.join(', ')}`);
	}
	for (const subcommand of rpgCommand.subcommands.values()) {
		if (
			!subcommand.description
			|| !subcommand.usage
			|| !Number.isFinite(subcommand.helpOrder)
			|| typeof subcommand.configure !== 'function'
			|| typeof subcommand.execute !== 'function'
		) {
			errors.push(`Invalid RPG subcommand: ${subcommand.name}`);
		}
	}
	checkHelpOrder(rpgCommand.subcommands.values(), 'RPG subcommands');
	const generationHelpOrder = [
		'gen',
		'gen-char',
		'gen-help',
	].sort((left, right) => (
		rpgCommand.subcommands.get(left).helpOrder
		- rpgCommand.subcommands.get(right).helpOrder
	));
	if (generationHelpOrder.join(',') !== 'gen,gen-char,gen-help') {
		errors.push('RPG generation commands are not in the requested help order.');
	}
}

function checkSlashCommandData(commands) {
	const expectedCommands = ['help', 'purge', 'restart', 'rpg', 'say'];
	if ([...commands.keys()].sort().join(',') !== expectedCommands.join(',')) {
		errors.push(`Unexpected slash commands: ${[...commands.keys()].sort().join(', ')}.`);
	}

	for (const command of commands.values()) {
		const data = command.data.toJSON();
		if (
			data.name !== command.name
			|| data.description !== command.description
			|| command.usage.startsWith('!')
		) {
			errors.push(`Invalid slash-command metadata: ${command.name}.`);
		}
	}

	const rpgCommand = commands.get('rpg');
	const { EDIT_FIELDS } = require('../commands/rpg/editorFields');
	const { SET_HELP } = require('../commands/rpg/subcommands/set');
	const { GET_FIELDS, GET_HELP } = require('../commands/rpg/subcommands/get');
	if (
		EDIT_FIELDS.length < 30
		|| !GET_FIELDS.includes('personality')
		|| !GET_FIELDS.includes('status')
		|| SET_HELP.length > 2_000
		|| GET_HELP.length > 2_000
		|| !SET_HELP.includes('prefilled form')
		|| !SET_HELP.includes('`Name: Level: Description`')
		|| /\b(add|set|remove) <(?:value|position)>/.test(SET_HELP)
	) {
		errors.push('The RPG editor or viewer help is incomplete or exceeds Discord limits.');
	}

	const slashSubcommands = rpgCommand.data.toJSON().options.map(option => option.name);
	if (
		slashSubcommands.length !== rpgCommand.subcommands.size
		|| slashSubcommands.some(name => !rpgCommand.subcommands.has(name))
	) {
		errors.push('The /rpg schema and routed subcommands do not match.');
	}

	const rpgData = rpgCommand.data.toJSON();
	const getSubcommand = name => rpgData.options.find(option => option.name === name);
	const hasAutocomplete = (subcommand, optionName) => getSubcommand(subcommand)
		?.options.find(option => option.name === optionName)?.autocomplete === true;
	for (const [subcommand, optionName] of [
		['damage', 'character-key'],
		['damage', 'damage-amount'],
		['delete', 'character-key'],
		['end-turn', 'character-key'],
		['gen', 'category'],
		['gen-char', 'level'],
		['gen-char', 'background'],
		['get', 'character-key'],
		['get', 'field'],
		['heal', 'character-key'],
		['heal', 'percentage'],
		['roll', 'sides'],
		['set', 'character-key'],
		['set', 'field'],
	]) {
		if (!hasAutocomplete(subcommand, optionName)) {
			errors.push(`Missing autocomplete for /rpg ${subcommand} ${optionName}.`);
		}
	}

	for (const commandName of ['purge']) {
		const option = commands.get(commandName).data.toJSON().options[0];
		if (!option.autocomplete) {
			errors.push(`Missing autocomplete for /${commandName}.`);
		}
	}

	const indexSource = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
	const clientSource = fs.readFileSync(path.join(root, 'client', 'Client.js'), 'utf8');
	if (
		indexSource.includes('MessageCreate')
		|| indexSource.includes('config.prefix')
		|| clientSource.includes('MessageContent')
	) {
		errors.push('Obsolete prefix-command handling or Message Content intent remains.');
	}
}

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
		const genCommand = require('../commands/rpg/subcommands/gen');
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
		const genHelp = require('../commands/rpg/subcommands/genhelp');
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

function checkHelpOrder(entries, label) {
	const orders = new Set();
	for (const entry of entries) {
		if (!Number.isFinite(entry.helpOrder)) {
			errors.push(`${entry.name} is missing a numeric helpOrder.`);
		}
		else if (orders.has(entry.helpOrder)) {
			errors.push(`Duplicate helpOrder ${entry.helpOrder} in ${label}.`);
		}
		orders.add(entry.helpOrder);
	}
}

function checkCharacterModel() {
	try {
		const original = new Character('Test', '0');
		setEditableFieldValue(original, 'firstName', 'Diego');
		setEditableFieldValue(original, 'lastName', 'Robert');
		setEditableFieldValue(original, 'stats.strength', '12');
		setEditableFieldValue(original, 'race.name', 'Ashborn');
		setEditableFieldValue(original, 'appearance', 'Tall with silver hair.');
		setEditableFieldValue(original, 'equipment', '- Longsword');
		setEditableFieldValue(original, 'personality.traits', '- Brave\n- Curious');
		setEditableFieldValue(
			original,
			'rules',
			'- Fire: 2: Controls flames\n- Blink: 1: Teleports a short distance',
		);
		try {
			setEditableFieldValue(original, 'rules', 'Fire: 0: Invalid level');
			errors.push('RULE levels below 1 should be rejected.');
		}
		catch (error) {
			if (error.code !== 'INVALID_CHARACTER_EDIT') {
				throw error;
			}
			setEditableFieldValue(
				original,
				'rules',
				'- Fire: 2: Controls flames\n- Blink: 1: Teleports a short distance',
			);
		}
		try {
			setEditableFieldValue(original, 'ap.max', '11');
			errors.push('AP values above 10 should be rejected.');
		}
		catch (error) {
			if (error.code !== 'INVALID_CHARACTER_EDIT') {
				throw error;
			}
		}
		original.resources.hp.current = 1;
		original.resources.ar.current = 30;
		original.resources.hp.current = 100;
		const armoredDamage = dealDamage(original, 40);
		if (
			armoredDamage.arDamage !== 30
			|| armoredDamage.hpDamage !== 10
			|| original.resources.ar.current !== 0
			|| original.resources.hp.current !== 90
		) {
			errors.push('Normal damage does not reduce AR before HP.');
		}
		original.resources.ar.current = 20;
		const piercingDamage = dealDamage(original, 15, true);
		if (
			piercingDamage.arDamage !== 0
			|| piercingDamage.hpDamage !== 15
			|| original.resources.ar.current !== 20
			|| original.resources.hp.current !== 75
		) {
			errors.push('Piercing damage does not bypass AR.');
		}
		try {
			dealDamage(original, 0);
			errors.push('Non-positive damage should be rejected.');
		}
		catch (error) {
			if (error.code !== 'INVALID_CHARACTER_EDIT') {
				throw error;
			}
		}
		original.resources.hp.current = 1;
		original.resources.ar.current = 0;
		original.resources.ap.current = 0;
		original.resources.md.current = 0;
		restoreResource(original, 'hp', 50);
		resetTurnResources(original);
		const character = Character.fromSave(JSON.parse(JSON.stringify(original)));
		if (
			character.creatorId !== '0'
			|| character.key !== 'Test'
			|| character.firstName !== 'Diego'
			|| character.lastName !== 'Robert'
			|| character.displayName !== 'Diego Robert'
			|| character.stats.strength !== 12
			|| character.race.name !== 'Ashborn'
			|| character.appearance !== 'Tall with silver hair.'
			|| getEditableFieldValue(character, 'personality.traits') !== 'Brave\nCurious'
			|| getEditableFieldValue(character, 'rules')
				!== 'Fire: 2: Controls flames\nBlink: 1: Teleports a short distance'
			|| character.rules[0]?.description !== 'Controls flames'
			|| character.rules[0]?.level !== 2
			|| character.rules[1]?.name !== 'Blink'
			|| character.rules[1]?.level !== 1
			|| character.equipment[0] !== 'Longsword'
			|| character.resources.hp.current !== 50
			|| character.resources.ap.current !== character.resources.ap.max
			|| character.resources.md.current !== character.resources.md.max
		) {
			errors.push('Character saves are not restored correctly.');
		}
		const summary = character.toEmbed().toJSON();
		const status = summary.fields.find(field => field.name === 'Status');
		if (
			!summary.description.includes('Tall with silver hair.')
			|| !status
			|| !status.value.includes('HP: **50 / 100 (50%)**')
			|| !status.value.includes(`${'❤️'.repeat(5)}${'🖤'.repeat(5)}`)
			|| !status.value.includes('🟧'.repeat(10))
			|| !status.value.includes('AP:\n🌟🌟🌟🌟')
			|| summary.fields.some(field => field.name === 'Status effects')
			|| summary.fields[1]?.name !== 'Statistics'
			|| summary.fields[2]?.name !== 'RULEs'
			|| summary.fields.some(field => field.name === '\u200B')
			|| !summary.fields[1]?.value.includes('**Racial traits**')
			|| summary.fields[1]?.value.includes('Initiative:')
			|| summary.fields[1]?.value.includes('Reflexes:')
			|| !summary.fields[2]?.value.includes('Fire (Level 2)')
			|| !summary.fields[2]?.value.includes('**Talents**')
		) {
			errors.push('The character summary status is not formatted correctly.');
		}
		for (const field of ['appearance', 'race', 'personality', 'statistics', 'rules', 'status']) {
			const fieldEmbed = character.toFieldEmbed(field)?.toJSON();
			if (field === 'rules' && !fieldEmbed.description.includes('Fire — Level 2')) {
				errors.push('The detailed RULE view does not show RULE levels.');
			}
			if (
				field === 'statistics'
				&& !fieldEmbed.fields?.find(item => item.name === 'Derived statistics')
					?.value.includes('Initiative:')
			) {
				errors.push('The detailed statistics view should retain derived statistics.');
			}
		}
		const legacyCharacter = Character.fromSave({
			key: 'Legacy',
			creatorId: '0',
			rules: [{ name: 'Legacy RULE', description: 'Saved without a level.' }],
		});
		if (legacyCharacter.rules[0]?.level !== 1) {
			errors.push('Legacy RULEs should default to level 1.');
		}
		character.resources.ap.current = 2;
		character.resources.ap.max = 4;
		const apDetail = character.toFieldEmbed('ap').toJSON();
		if (apDetail.description !== 'AP:\n🌟🌟⭐⭐') {
			errors.push('AP availability is not displayed correctly.');
		}
		if (character.toFieldEmbed('unknown') !== null) {
			errors.push('Unknown character detail fields should be rejected.');
		}

	}
	catch (error) {
		errors.push(`Character model: ${error.message}`);
	}
}

function checkRandomCharacterGeneration() {
	try {
		let seed = 12_345;
		const random = () => {
			seed = (seed * 1_664_525 + 1_013_904_223) % 4_294_967_296;
			return seed / 4_294_967_296;
		};
		const character = new Character('D.Robert', 'dm');
		populateRandomCharacter(character, { level: 10, random });
		const generatedRace = generatorCatalog.getCategory('race').entries
			.find(entry => entry.fields.Name === character.race.name);

		if (
			character.key !== 'D.Robert'
			|| character.level !== 10
			|| !character.firstName
			|| !character.lastName
			|| character.displayName !== `${character.firstName} ${character.lastName}`
			|| !character.race.name
			|| !character.race.physicalDescription
			|| character.race.lore
			|| !character.appearance
			|| !character.backstory
			|| !character.goals
			|| character.personality.traits.length !== 2
			|| character.personality.description
			|| character.racialTraits.skillBonus !== generatedRace?.fields['Skill Bonus']
			|| character.racialTraits.physicalAbility
				!== generatedRace?.fields['Physical Ability']
		) {
			errors.push('Generated identity or intentionally empty fields are incorrect.');
		}

		if (
			calculateStatCost(character.stats) !== calculateStatBudget(character.level)
			|| BASE_STAT_NAMES.some(stat => (
				character.stats[stat] < 4 || character.stats[stat] > 20
			))
			|| character.stats.initiative !== character.stats.speed
			|| character.stats.reflexes !== character.stats.speed
		) {
			errors.push('Generated statistics do not follow the point-allocation rules.');
		}

		const expectedRulePoints = calculateRulePoints(character.stats.intelligence);
		const expectedRuleLevels = allocateRuleLevels(expectedRulePoints);
		const expectedTalentCount = 4;
		if (
			character.rules.length !== expectedRuleLevels.length
			|| character.rules.some((rule, index) => rule.level !== expectedRuleLevels[index])
			|| new Set(character.rules.map(rule => rule.name)).size !== character.rules.length
			|| character.talents.split('\n').length !== expectedTalentCount
		) {
			errors.push('Generated RULEs or talents do not match the character attributes.');
		}
		const expectedAllocations = [
			[],
			[1],
			[1, 1],
			[2],
			[2, 1],
			[2, 1],
			[3],
		];
		if (expectedAllocations.some((levels, points) => (
			JSON.stringify(allocateRuleLevels(points)) !== JSON.stringify(levels)
		))) {
			errors.push('RULE Point allocation does not prioritize RULE levels correctly.');
		}

		const expectedHp = Math.round(
			character.stats.constitution * 10 * (1 + 0.2 * (character.level - 1)),
		);
		if (
			character.resources.hp.max !== expectedHp
			|| character.resources.hp.current !== expectedHp
			|| character.resources.ap.max !== calculateMaxAp(character.level)
			|| character.resources.ap.current !== character.resources.ap.max
			|| character.resources.md.max !== character.stats.speed * 0.5
			|| character.resources.md.current !== character.resources.md.max
		) {
			errors.push('Generated HP, AP, or MD values are incorrect.');
		}

		const armorName = character.equipment[0].split(' — ')[0];
		const armor = generatorCatalog.getCategory('armors').entries
			.find(entry => entry.fields.Name === armorName);
		const armorPercentage = Number(armor?.fields['AR percentage']);
		if (
			!armor
			|| Number(armor.fields['Constitution requirement']) > character.stats.constitution
			|| character.resources.ar.max !== Math.round(expectedHp * armorPercentage / 100)
			|| character.resources.ar.current !== character.resources.ar.max
			|| character.equipment.length < 2
			|| character.equipment.length > 3
			|| character.inventory.length !== 4
			|| !character.inventory.at(-1).endsWith(' gold')
			|| character.encumbrance.max !== character.stats.constitution
		) {
			errors.push('Generated armor, equipment, inventory, AR, or encumbrance is incorrect.');
		}
		character.toEmbed().toJSON();

		const routedBackgrounds = generatorCatalog.getCategory('background').entries;
		for (const routedBackground of routedBackgrounds) {
			const backgroundName = routedBackground.fields.Name;
			const routedCharacter = new Character(`background.${backgroundName}`, 'dm');
			populateRandomCharacter(routedCharacter, {
				level: 1,
				background: backgroundName,
				random: () => 0,
			});
			if (
				!routedCharacter.appearance
				|| !routedCharacter.backstory
				|| !routedCharacter.goals
			) {
				errors.push(`Random generation failed for background: ${backgroundName}.`);
			}
		}
	}
	catch (error) {
		errors.push(`Random character generation: ${error.message}`);
	}
}

async function checkCharacterStore() {
	const suffix = `${process.pid}_${Date.now()}`;
	const originalName = `check.${suffix}`;
	const savePath = path.join(root, 'save', `${originalName}.json`);

	try {
		await characterStore.createCharacter(originalName, 'creator');
		try {
			await characterStore.createCharacter(originalName, 'creator');
			errors.push('A duplicate character key was allowed.');
		}
		catch (error) {
			if (error.code !== 'EEXIST') {
				throw error;
			}
		}
		try {
			await characterStore.updateCharacter(originalName, 'stranger', false, () => {});
			errors.push('A non-owner was allowed to edit a character.');
		}
		catch (error) {
			if (error.code !== 'NOT_CHARACTER_EDITOR') {
				throw error;
			}
		}

		await characterStore.updateCharacter(originalName, 'dm-user', true, character => {
			character.firstName = 'A Display';
			character.lastName = 'Name With Spaces';
			character.resources.hp.current = 42;
		});
		const editedCharacter = await characterStore.getCharacter(originalName);
		if (
			editedCharacter.firstName !== 'A Display'
			|| editedCharacter.lastName !== 'Name With Spaces'
			|| editedCharacter.displayName !== 'A Display Name With Spaces'
			|| editedCharacter.key !== originalName
			|| editedCharacter.resources.hp.current !== 42
		) {
			errors.push('Character edits are not persisted correctly.');
		}
		await characterStore.deleteCharacter(originalName, 'creator');
	}
	catch (error) {
		errors.push(`Character store: ${error.message}`);
	}
	finally {
		try {
			fs.unlinkSync(savePath);
		}
		catch (error) {
			if (error.code !== 'ENOENT') {
				errors.push(`Could not clean up character check: ${error.message}`);
			}
		}
	}
}

async function checkInteractiveRpgUx() {
	const suffix = `${process.pid}_${Date.now()}`;
	const characterKey = `ux.${suffix}`;
	const { handleRpgInteraction, openCharacterEditor } = require(
		'../commands/rpg/interactions'
	);
	const user = { id: 'ux-creator' };
	const member = {
		roles: {
			cache: {
				some: () => false,
			},
		},
	};

	try {
		await characterStore.createCharacter(characterKey, user.id, character => {
			character.firstName = 'Modal';
			character.lastName = 'Tester';
		});

		let modalPayload;
		await openCharacterEditor({
			user,
			member,
			showModal: async modal => {
				modalPayload = modal.toJSON();
			},
		}, config, characterKey, 'stats.strength');
		if (
			modalPayload.title !== 'Edit Strength'
			|| modalPayload.components.length !== 1
			|| modalPayload.components[0].component.value !== '10'
		) {
			errors.push('The direct RPG editor did not prefill a valid statistics modal.');
		}

		let submitPayload;
		await handleRpgInteraction({
			customId: modalPayload.custom_id,
			user,
			member,
			isModalSubmit: () => true,
			fields: {
				getTextInputValue: () => '14',
			},
			reply: async payload => {
				submitPayload = payload;
			},
		}, config);
		const editedCharacter = await characterStore.getCharacter(characterKey);
		if (!submitPayload || editedCharacter.stats.strength !== 14) {
			errors.push('The direct RPG editor did not save its modal value.');
		}

	}
	catch (error) {
		errors.push(`Interactive RPG UX: ${error.message}`);
	}
	finally {
		try {
			await characterStore.deleteCharacter(characterKey, user.id);
		}
		catch (error) {
			if (error.code !== 'ENOENT') {
				errors.push(`Could not clean up interactive UX check: ${error.message}`);
			}
		}
	}
}

function checkConfiguration() {
	if (Object.hasOwn(config, 'token')) {
		errors.push('config.json must not contain a token.');
	}
	for (const key of ['botUserId', 'roles', 'channels']) {
		if (!config[key]) {
			errors.push(`config.json is missing ${key}.`);
		}
	}
	if (Object.hasOwn(config, 'prefix')) {
		errors.push('config.json should not contain an obsolete message-command prefix.');
	}
	for (const role of ['newMember', 'member', 'dm', 'moderator', 'owner']) {
		if (!config.roles?.[role]) {
			errors.push(`config.json is missing the ${role} role.`);
		}
	}
}

function checkAuthorization(commands) {
	const createMessage = (roleIds, channelId) => ({
		channel: { id: channelId },
		member: {
			roles: {
				cache: {
					some: predicate => roleIds.some(id => predicate({ id })),
				},
			},
		},
	});

	const memberMessage = createMessage([config.roles.member], '0');
	if (!authorizeCommand(commands.get('help'), memberMessage, config).allowed) {
		errors.push('Members should be allowed to use the help command.');
	}

	const moderatorMessage = createMessage([config.roles.moderator], '0');
	if (!authorizeCommand(commands.get('restart'), moderatorMessage, config).allowed) {
		errors.push('Moderators should be allowed to restart the bot.');
	}

	const ownerMessage = createMessage([config.roles.owner], '0');
	if (!authorizeCommand(commands.get('restart'), ownerMessage, config).allowed) {
		errors.push('The owner should be allowed to restart the bot.');
	}

	if (authorizeCommand(commands.get('restart'), memberMessage, config).allowed) {
		errors.push('Regular members should not be allowed to restart the bot.');
	}

	const genCommand = commands.get('rpg')?.subcommands?.get('gen');
	const genCharCommand = commands.get('rpg')?.subcommands
		?.get('gen-char');
	const genHelpCommand = commands.get('rpg')?.subcommands
		?.get('gen-help');
	const dmMessage = createMessage([config.roles.dm], '0');
	if (!authorizeCommand(genCommand, dmMessage, config).allowed) {
		errors.push('The DM should be allowed to generate RPG prompts.');
	}
	if (!authorizeCommand(genCommand, ownerMessage, config).allowed) {
		errors.push('The owner should be allowed to generate RPG prompts.');
	}
	if (authorizeCommand(genCommand, moderatorMessage, config).allowed) {
		errors.push('Moderators without the DM role should not generate RPG prompts.');
	}
	if (authorizeCommand(genCommand, memberMessage, config).allowed) {
		errors.push('Regular members should not generate RPG prompts.');
	}
	if (
		!authorizeCommand(genCharCommand, dmMessage, config).allowed
		|| !authorizeCommand(genCharCommand, ownerMessage, config).allowed
		|| authorizeCommand(genCharCommand, moderatorMessage, config).allowed
		|| authorizeCommand(genCharCommand, memberMessage, config).allowed
	) {
		errors.push('Random character generation should be restricted to DMs and owners.');
	}
	if (
		!authorizeCommand(genHelpCommand, dmMessage, config).allowed
		|| authorizeCommand(genHelpCommand, memberMessage, config).allowed
	) {
		errors.push('Generator help should be restricted to DMs and owners.');
	}

	const memberUsingOwnerCommand = authorizeCommand(
		commands.get('purge'),
		memberMessage,
		config,
	);
	if (memberUsingOwnerCommand.allowed) {
		errors.push('Members should not be allowed to use owner commands.');
	}
}

function checkRequiredFiles() {
	const localAudioFile = path.join('media', 'Poutouyemoun.mp3');
	for (const file of [
		path.join('documentation', 'TTRPG_RANDOM_RULES_EN.md'),
		path.join('media', 'HEADS.gif'),
		path.join('media', 'LOGO.jpg'),
		localAudioFile,
		path.join('media', 'TAILS.gif'),
	]) {
		if (!fs.existsSync(path.join(root, file))) {
			errors.push(`Required file is missing: ${file}`);
		}
	}

	if (fs.existsSync(path.join(root, 'embeds', 'ruleList.json'))) {
		errors.push('The obsolete RPG rules embed still exists.');
	}

	const audioCheck = spawnSync(
		ffmpegPath,
		['-v', 'error', '-i', path.join(root, localAudioFile), '-f', 'null', '-'],
		{ encoding: 'utf8' },
	);
	if (audioCheck.status !== 0) {
		errors.push(`Local MP3 validation failed: ${audioCheck.stderr.trim()}`);
	}
}

function findJavaScriptFiles(directory) {
	const files = [];
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		if (['.git', 'node_modules'].includes(entry.name)) {
			continue;
		}
		const fullPath = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...findJavaScriptFiles(fullPath));
		}
		else if (entry.name.endsWith('.js')) {
			files.push(fullPath);
		}
	}
	return files;
}

main().catch(error => {
	console.error(error);
	process.exitCode = 1;
});

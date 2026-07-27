const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ffmpegPath = require('ffmpeg-static');
const { generateDependencyReport } = require('@discordjs/voice');
const Character = require('../models/Character');
const config = require('../config.json');
const characterStore = require('../services/characterStore');
const {
	editCharacter,
	resetTurnResources,
	restoreResource,
} = require('../services/characterEditor');
const generatorCatalog = require('../services/generatorCatalog');
const { authorizeCommand } = require('../util/authorization');
const { loadCommands } = require('../util/loadCommands');

const root = path.join(__dirname, '..');
const errors = [];

async function main() {
	checkNodeVersion();
	checkJavaScriptSyntax();
	const commands = checkCommands();
	checkHelpOrder(commands.values(), 'top-level commands');
	checkRpgStructure(commands);
	await checkRpgRouting(commands);
	checkGeneratorCatalog();
	checkCharacterModel();
	await checkCharacterStore();
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
		'delete',
		'edit',
		'edithelp',
		'endturn',
		'generate',
		'help',
		'rest',
		'rules',
		'view',
		'viewhelp',
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
			|| typeof subcommand.execute !== 'function'
		) {
			errors.push(`Invalid RPG subcommand: ${subcommand.name}`);
		}
	}
	checkHelpOrder(rpgCommand.subcommands.values(), 'RPG subcommands');
}

async function checkRpgRouting(commands) {
	const replies = [];
	const context = {
		args: [],
		config,
		message: {
			reply: async message => replies.push(message),
		},
	};
	const rpgCommand = commands.get('rpg');
	await rpgCommand.execute(context);
	await rpgCommand.execute({ ...context, args: ['UnknownCharacter'] });
	if (
		replies.length !== 2
		|| !replies[0].includes('!rpg help')
		|| !replies[1].includes('Unknown RPG command')
	) {
		errors.push('RPG commands should require an explicit subcommand.');
	}

	const viewCommand = rpgCommand.subcommands.get('view');
	if (
		viewCommand.VIEW_HELP.length > 2_000
		|| !viewCommand.VIEW_FIELDS.includes('personality')
		|| !viewCommand.VIEW_FIELDS.includes('status')
	) {
		errors.push('The RPG view help is missing required fields or exceeds Discord limits.');
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

		const powerResult = generatorCatalog.generate('power', () => 0);
		if (
			!powerResult?.entry?.fields?.Name
			|| !powerResult.entry.fields.Description
		) {
			errors.push('Power generators should expose separate Name and Description fields.');
		}
		const generateCommand = require('../commands/rpg/subcommands/generate');
		const structuredEmbed = generateCommand.createGeneratedEmbed(powerResult).toJSON();
		if (
			structuredEmbed.fields?.[0]?.name !== 'Name'
			|| structuredEmbed.fields?.[1]?.name !== 'Description'
		) {
			errors.push('Structured generator fields are not rendered correctly.');
		}
		const weightedTextEmbed = generateCommand.createGeneratedEmbed({
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
		editCharacter(original, 'stats.strength', ['12']);
		editCharacter(original, 'race.name', ['Ashborn']);
		editCharacter(original, 'personality.traits', ['add', 'Brave']);
		editCharacter(original, 'rules', ['add', 'Fire', '|', 'Controls flames']);
		editCharacter(original, 'equipment', ['add', 'Longsword']);
		try {
			editCharacter(original, 'ap.max', ['11']);
			errors.push('AP values above 10 should be rejected.');
		}
		catch (error) {
			if (error.code !== 'INVALID_CHARACTER_EDIT') {
				throw error;
			}
		}
		original.resources.hp.current = 1;
		original.resources.ap.current = 0;
		original.resources.md.current = 0;
		restoreResource(original, 'hp', 50);
		resetTurnResources(original);
		const character = Character.fromSave(JSON.parse(JSON.stringify(original)));
		if (
			character.creatorId !== '0'
			|| character.stats.strength !== 12
			|| character.race.name !== 'Ashborn'
			|| character.personality.traits[0] !== 'Brave'
			|| character.rules[0]?.description !== 'Controls flames'
			|| character.resources.hp.current !== 50
			|| character.resources.ap.current !== character.resources.ap.max
			|| character.resources.md.current !== character.resources.md.max
		) {
			errors.push('Character saves are not restored correctly.');
		}
		const summary = character.toEmbed().toJSON();
		const status = summary.fields.find(field => field.name === 'Status');
		if (
			!status
			|| !status.value.includes('HP: **50 / 100 (50%)**')
			|| !status.value.includes('AP:\n🌟🌟🌟🌟')
			|| summary.fields.some(field => field.name === 'Status effects')
			|| summary.fields[1]?.name !== 'Statistics'
			|| summary.fields[2]?.name !== 'RULEs'
			|| summary.fields.some(field => field.name === '\u200B')
			|| !summary.fields[1]?.value.includes('**Racial traits**')
			|| !summary.fields[2]?.value.includes('**Talents**')
		) {
			errors.push('The character summary status is not formatted correctly.');
		}
		for (const field of ['race', 'personality', 'statistics', 'rules', 'status']) {
			character.toFieldEmbed(field)?.toJSON();
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

		const legacyCharacter = Character.fromSave({
			name: 'Legacy',
			creatorId: '1',
			battle: { currentHp: 20, maxHp: 80, armor: 10 },
			inventory: { equipment: ['Spear'], bag: ['Rope'] },
		});
		if (
			legacyCharacter.resources.hp.current !== 20
			|| legacyCharacter.resources.hp.max !== 80
			|| legacyCharacter.equipment[0] !== 'Spear'
			|| legacyCharacter.inventory[0] !== 'Rope'
		) {
			errors.push('Legacy character saves are not migrated correctly.');
		}
	}
	catch (error) {
		errors.push(`Character model: ${error.message}`);
	}
}

async function checkCharacterStore() {
	const suffix = `${process.pid}_${Date.now()}`;
	const originalName = `check_${suffix}`;
	const savePath = path.join(root, 'save', `${originalName}.json`);

	try {
		await characterStore.createCharacter(originalName, 'creator');
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
			character.name = 'A Display Name With Spaces';
			character.resources.hp.current = 42;
		});
		const editedCharacter = await characterStore.getCharacter(originalName);
		if (
			editedCharacter.name !== 'A Display Name With Spaces'
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

function checkConfiguration() {
	if (Object.hasOwn(config, 'token')) {
		errors.push('config.json must not contain a token.');
	}
	for (const key of ['prefix', 'botUserId', 'roles', 'channels']) {
		if (!config[key]) {
			errors.push(`config.json is missing ${key}.`);
		}
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

	const generateCommand = commands.get('rpg')?.subcommands?.get('generate');
	const dmMessage = createMessage([config.roles.dm], '0');
	if (!authorizeCommand(generateCommand, dmMessage, config).allowed) {
		errors.push('The DM should be allowed to generate RPG prompts.');
	}
	if (!authorizeCommand(generateCommand, ownerMessage, config).allowed) {
		errors.push('The owner should be allowed to generate RPG prompts.');
	}
	if (authorizeCommand(generateCommand, moderatorMessage, config).allowed) {
		errors.push('Moderators without the DM role should not generate RPG prompts.');
	}
	if (authorizeCommand(generateCommand, memberMessage, config).allowed) {
		errors.push('Regular members should not generate RPG prompts.');
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

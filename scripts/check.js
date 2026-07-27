const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ffmpegPath = require('ffmpeg-static');
const { generateDependencyReport } = require('@discordjs/voice');
const Character = require('../models/Character');
const config = require('../config.json');
const generatorCatalog = require('../services/generatorCatalog');
const { authorizeCommand } = require('../util/authorization');
const { loadCommands } = require('../util/loadCommands');

const root = path.join(__dirname, '..');
const errors = [];

checkNodeVersion();
checkJavaScriptSyntax();
const commands = checkCommands();
checkHelpOrder(commands.values(), 'top-level commands');
checkRpgStructure(commands);
checkGeneratorCatalog();
checkCharacterModel();
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

	const expectedSubcommands = ['add', 'delete', 'generate', 'help', 'rules', 'view'];
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

function checkGeneratorCatalog() {
	try {
		const expectedCategories = [
			'enemy',
			'event',
			'location',
			'loot',
			'npc',
			'personality',
			'power',
			'quest',
			'race',
			'trap',
		];
		const categories = generatorCatalog.listCategories();
		const actualCategories = categories.map(category => category.key);
		if (actualCategories.join(',') !== expectedCategories.join(',')) {
			errors.push(`Unexpected generator categories: ${actualCategories.join(', ')}`);
		}

		for (const category of categories) {
			if (category.entries.length < 25) {
				errors.push(
					`Generator category ${category.name} needs at least 25 prompts; `
					+ `${category.entries.length} found.`,
				);
			}
			const firstResult = generatorCatalog.generate(category.name, () => 0);
			if (firstResult?.entry !== category.entries[0]) {
				errors.push(`Generator category ${category.name} cannot select its first prompt.`);
			}
		}

		if (generatorCatalog.getCategory('personalities')?.key !== 'personality') {
			errors.push('Plural generator category names are not normalized correctly.');
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
		original.stats.strength = 12;
		const character = Character.fromSave(JSON.parse(JSON.stringify(original)));
		if (character.creatorId !== '0' || character.stats.strength !== 12) {
			errors.push('Character saves are not restored correctly.');
		}
		character.toEmbed().toJSON();
	}
	catch (error) {
		errors.push(`Character model: ${error.message}`);
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

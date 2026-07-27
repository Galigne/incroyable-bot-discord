const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ffmpegPath = require('ffmpeg-static');
const { generateDependencyReport } = require('@discordjs/voice');
const Character = require('../models/Character');
const config = require('../config.json');
const { authorizeCommand } = require('../util/authorization');
const { loadCommands } = require('../util/loadCommands');

const root = path.join(__dirname, '..');
const errors = [];

checkNodeVersion();
checkJavaScriptSyntax();
const commands = checkCommands();
checkHelpOrder(commands.values(), 'top-level commands');
checkJdrStructure(commands);
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

function checkJdrStructure(commands) {
	const jdrCommand = commands.get('jdr');
	if (!jdrCommand?.subcommands) {
		errors.push('The JDR command must expose its subcommands.');
		return;
	}

	const expectedSubcommands = ['add', 'delete', 'help', 'rules', 'view'];
	const actualSubcommands = [...jdrCommand.subcommands.keys()].sort();
	if (actualSubcommands.join(',') !== expectedSubcommands.join(',')) {
		errors.push(`Unexpected JDR subcommands: ${actualSubcommands.join(', ')}`);
	}
	for (const subcommand of jdrCommand.subcommands.values()) {
		if (
			!subcommand.description
			|| !subcommand.usage
			|| !Number.isFinite(subcommand.helpOrder)
			|| typeof subcommand.execute !== 'function'
		) {
			errors.push(`Invalid JDR subcommand: ${subcommand.name}`);
		}
	}
	checkHelpOrder(jdrCommand.subcommands.values(), 'JDR subcommands');
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

	const memberMessage = createMessage([config.roles.member], config.channels.music);
	if (!authorizeCommand(commands.get('help'), memberMessage, config).allowed) {
		errors.push('Members should be allowed to use the help command.');
	}

	const ownerInWrongChannel = createMessage([config.roles.owner], '0');
	if (authorizeCommand(commands.get('restart'), ownerInWrongChannel, config).allowed) {
		errors.push('Restart should be rejected outside the commands channel.');
	}

	const ownerInCommandsChannel = createMessage(
		[config.roles.owner],
		config.channels.commands,
	);
	if (!authorizeCommand(commands.get('restart'), ownerInCommandsChannel, config).allowed) {
		errors.push('The owner should be allowed to restart in the commands channel.');
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
		path.join('documentation', 'JDR_RANDOM_RULES_EN.md'),
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
		errors.push('The obsolete JDR rules embed still exists.');
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

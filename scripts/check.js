const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { EmbedBuilder } = require('discord.js');
const { generateDependencyReport } = require('@discordjs/voice');
const Character = require('../classes/Character');
const config = require('../config.json');

const root = path.join(__dirname, '..');
const errors = [];

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 12)) {
	errors.push(`Node.js ${process.versions.node} est trop ancien (22.12.0 minimum).`);
}

for (const file of findJavaScriptFiles(root)) {
	const result = spawnSync(process.execPath, ['--check', file], {
		encoding: 'utf8',
	});
	if (result.status !== 0) {
		errors.push(`${path.relative(root, file)}: ${result.stderr.trim()}`);
	}
}

const commands = fs.readdirSync(path.join(root, 'commands'))
	.filter(file => file.endsWith('.js'));
const names = new Set();
for (const file of commands) {
	try {
		const command = require(path.join(root, 'commands', file));
		if (!command.name || typeof command.execute !== 'function') {
			errors.push(`${file}: export de commande invalide.`);
		}
		else if (names.has(command.name.toLowerCase())) {
			errors.push(`${file}: nom de commande dupliqué (${command.name}).`);
		}
		names.add(command.name.toLowerCase());
	}
	catch (error) {
		errors.push(`${file}: ${error.stack}`);
	}
}

for (const [file, attachment] of [
	['commandList.json', path.join('media', 'LOGO.jpg')],
	['ruleList.json', path.join('media', 'book.jpg')],
]) {
	try {
		const rawEmbed = require(path.join(root, 'embeds', file));
		const { color, ...embedData } = rawEmbed;
		new EmbedBuilder(embedData).setColor(color).toJSON();
		if (!fs.existsSync(path.join(root, attachment))) {
			errors.push(`Fichier manquant : ${attachment}.`);
		}
	}
	catch (error) {
		errors.push(`${file}: ${error.message}`);
	}
}

try {
	new Character('Test', '0').toMessageEmbed().toJSON();
}
catch (error) {
	errors.push(`Character: ${error.message}`);
}

if (Object.hasOwn(config, 'token')) {
	errors.push('config.json ne doit pas contenir de token.');
}

if (errors.length > 0) {
	console.error(errors.join('\n\n'));
	process.exitCode = 1;
}
else {
	console.log(`Vérification réussie : ${commands.length} commandes chargées.`);
	console.log(generateDependencyReport());
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

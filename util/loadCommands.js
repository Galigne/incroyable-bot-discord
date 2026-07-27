const fs = require('node:fs');
const path = require('node:path');
const { Collection } = require('discord.js');

function loadCommands(commandsDirectory) {
	const commands = new Collection();
	const entries = fs.readdirSync(commandsDirectory, { withFileTypes: true })
		.sort((left, right) => left.name.localeCompare(right.name));

	for (const entry of entries) {
		const commandFile = resolveCommandFile(commandsDirectory, entry);
		if (!commandFile) {
			continue;
		}

		const command = require(commandFile);
		validateCommand(command, commandFile);

		const commandName = command.name.toLowerCase();
		if (commands.has(commandName)) {
			throw new Error(`Duplicate command name: ${commandName}`);
		}
		commands.set(commandName, command);
	}

	return commands;
}

function resolveCommandFile(commandsDirectory, entry) {
	if (entry.isFile() && entry.name.endsWith('.js')) {
		return path.join(commandsDirectory, entry.name);
	}
	if (entry.isDirectory()) {
		const indexFile = path.join(commandsDirectory, entry.name, 'index.js');
		return fs.existsSync(indexFile) ? indexFile : null;
	}
	return null;
}

function validateCommand(command, commandFile) {
	if (
		!command.name
		|| !command.description
		|| !Number.isFinite(command.helpOrder)
		|| typeof command.data?.toJSON !== 'function'
		|| typeof command.execute !== 'function'
	) {
		throw new Error(
			`${commandFile} must export a name, description, numeric helpOrder, `
			+ 'slash-command data, and execute function.',
		);
	}
}

module.exports = { loadCommands };

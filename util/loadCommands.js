const commandRegistry = require('../commands/registry');

function loadCommands() {
	return commandRegistry.getRuntimeCommands();
}

module.exports = { loadCommands };

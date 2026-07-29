class RuntimeState {
	constructor(client, { config, commandRegistry }) {
		this.client = client;
		this.config = config;
		this.commandRegistry = null;
		this.replaceCommandRegistry(commandRegistry);
	}

	getConfig() {
		return this.config;
	}

	getCommandRegistry() {
		return this.commandRegistry;
	}

	replaceConfig(config) {
		this.config = config;
	}

	replaceCommandRegistry(commandRegistry) {
		const commands = commandRegistry.getRuntimeCommands();
		if (commands.size !== new Set(commands.keys()).size) {
			throw new Error('The runtime command collection contains duplicate names.');
		}
		this.commandRegistry = commandRegistry;
		this.client.commandRegistry = commandRegistry;
		this.client.commands = commands;
	}
}

module.exports = { RuntimeState };

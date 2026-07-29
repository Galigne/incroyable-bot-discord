async function registerCommands(client, commandRegistry) {
	if (!client.application?.commands) {
		throw new Error('The Discord application command manager is unavailable.');
	}
	const commands = commandRegistry.getDiscordCommandData()
		.map(command => command.toJSON());
	await client.application.commands.set(commands);
	return commands.length;
}

module.exports = { registerCommands };

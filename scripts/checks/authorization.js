module.exports = function createAuthorizationChecks(context) {
	const {
		authorizeCommand,
		config,
		errors,
	} = context;

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

	return {
		checkAuthorization,
	};
};


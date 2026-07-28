module.exports = function createAuthorizationChecks(context) {
	const {
		authorizeCommand,
		canManageCharacter,
		config,
		errors,
		hasDmPermission,
		hasModeratorPermission,
		isGuildOwner,
	} = context;

	function checkAuthorization(commands) {
		const owner = createInteraction('server-owner', [], 'server-owner');
		const dm = createInteraction('dm-user', [config.roles.dm]);
		const moderator = createInteraction('moderator-user', [config.roles.moderator]);
		const regular = createInteraction('regular-user', []);
		const directMessage = createInteraction('dm-user', [config.roles.dm], null);

		const privilegedCommands = [
			commands.get('say'),
			commands.get('purge'),
			commands.get('restart'),
			commands.get('rpg')?.subcommands?.get('gen'),
			commands.get('rpg')?.subcommands?.get('gen-char'),
		];
		for (const command of privilegedCommands) {
			if (!authorizeCommand(command, owner, config).allowed) {
				errors.push(`The server owner should be allowed to use ${command?.name}.`);
			}
		}

		if (!isGuildOwner(owner) || isGuildOwner(regular) || isGuildOwner(directMessage)) {
			errors.push('Server ownership must come exclusively from guild.ownerId.');
		}
		if (!hasDmPermission(owner, config) || !hasModeratorPermission(owner, config)) {
			errors.push('The server owner should bypass all privileged role checks.');
		}

		for (const name of ['gen', 'gen-char']) {
			const command = commands.get('rpg')?.subcommands?.get(name);
			if (!authorizeCommand(command, dm, config).allowed) {
				errors.push(`The DM role should be allowed to use ${name}.`);
			}
			if (authorizeCommand(command, moderator, config).allowed) {
				errors.push(`The moderator role alone should not be allowed to use ${name}.`);
			}
			if (authorizeCommand(command, regular, config).allowed) {
				errors.push(`A regular user should not be allowed to use ${name}.`);
			}
		}

		for (const name of ['say', 'purge', 'restart']) {
			const command = commands.get(name);
			if (!authorizeCommand(command, moderator, config).allowed) {
				errors.push(`The moderator role should be allowed to use ${name}.`);
			}
			if (authorizeCommand(command, dm, config).allowed) {
				errors.push(`The DM role alone should not be allowed to use ${name}.`);
			}
			if (authorizeCommand(command, regular, config).allowed) {
				errors.push(`A regular user should not be allowed to use ${name}.`);
			}
		}

		const unrestrictedCommands = [
			commands.get('help'),
			commands.get('rpg')?.subcommands?.get('gen-help'),
			commands.get('rpg')?.subcommands?.get('get'),
			commands.get('rpg')?.subcommands?.get('roll'),
		];
		for (const command of unrestrictedCommands) {
			if (!authorizeCommand(command, regular, config).allowed) {
				errors.push(`Regular users should be allowed to use ${command?.name}.`);
			}
		}

		const privilegedInDirectMessage = authorizeCommand(
			commands.get('restart'),
			directMessage,
			config,
		);
		if (
			privilegedInDirectMessage.allowed
			|| !privilegedInDirectMessage.message
		) {
			errors.push('Guild-only permission checks should fail cleanly in direct messages.');
		}
		if (
			hasDmPermission(directMessage, config)
			|| hasModeratorPermission(directMessage, config)
		) {
			errors.push('Direct messages must never satisfy guild role checks.');
		}

		const ownedCharacter = { creatorId: regular.user.id };
		const otherCharacter = { creatorId: 'someone-else' };
		if (!canManageCharacter(regular, ownedCharacter, config)) {
			errors.push('Regular users should manage their own characters.');
		}
		if (canManageCharacter(regular, otherCharacter, config)) {
			errors.push('Regular users should not manage other characters.');
		}
		if (!canManageCharacter(dm, otherCharacter, config)) {
			errors.push('The DM role should manage any character.');
		}
		if (!canManageCharacter(owner, otherCharacter, config)) {
			errors.push('The server owner should manage any character.');
		}
		if (canManageCharacter(moderator, otherCharacter, config)) {
			errors.push('The moderator role alone should not manage other characters.');
		}

		const missingDmConfig = {
			...config,
			roles: { moderator: config.roles.moderator },
		};
		const invalidAuthorization = authorizeCommand(
			commands.get('rpg')?.subcommands?.get('gen'),
			dm,
			missingDmConfig,
		);
		if (invalidAuthorization.allowed || !invalidAuthorization.message.includes('roles.dm')) {
			errors.push('Missing permission configuration should return a clear localized error.');
		}
	}

	function createInteraction(userId, roleIds, ownerId = 'server-owner') {
		const guild = ownerId === null ? null : { ownerId };
		return {
			guild,
			guildId: guild ? 'guild' : null,
			member: {
				roles: {
					cache: {
						has: roleId => roleIds.includes(roleId),
					},
				},
			},
			user: { id: userId },
		};
	}

	return {
		checkAuthorization,
	};
};

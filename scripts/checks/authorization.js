module.exports = function createAuthorizationChecks(context) {
	const {
		authorizeCommand,
		canManageEntity,
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
			commands.get('reload'),
			commands.get('gen'),
			commands.get('gen-char'),
			commands.get('gen-creature'),
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

		for (const name of ['gen', 'gen-char', 'gen-creature']) {
			const command = commands.get(name);
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

		for (const name of ['say', 'purge', 'reload']) {
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
			commands.get('get'),
			commands.get('roll'),
		];
		for (const command of unrestrictedCommands) {
			if (!authorizeCommand(command, regular, config).allowed) {
				errors.push(`Regular users should be allowed to use ${command?.name}.`);
			}
		}

		const privilegedInDirectMessage = authorizeCommand(
			commands.get('reload'),
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

		const ownedEntity = { creatorId: regular.user.id };
		const otherEntity = { creatorId: 'someone-else' };
		if (!canManageEntity(regular, ownedEntity, config)) {
			errors.push('Regular users should manage their own entities.');
		}
		if (canManageEntity(regular, otherEntity, config)) {
			errors.push('Regular users should not manage other entities.');
		}
		if (!canManageEntity(dm, otherEntity, config)) {
			errors.push('The DM role should manage any entity.');
		}
		if (!canManageEntity(owner, otherEntity, config)) {
			errors.push('The server owner should manage any entity.');
		}
		if (canManageEntity(moderator, otherEntity, config)) {
			errors.push('The moderator role alone should not manage other entities.');
		}

		const missingDmConfig = {
			...config,
			roles: { moderator: config.roles.moderator },
		};
		const invalidAuthorization = authorizeCommand(
			commands.get('gen'),
			dm,
			missingDmConfig,
		);
		if (invalidAuthorization.allowed || !invalidAuthorization.message) {
			errors.push('An omitted DM role should deny non-owner users cleanly.');
		}
		if (!authorizeCommand(commands.get('gen'), owner, missingDmConfig).allowed) {
			errors.push('An omitted DM role must preserve the server-owner bypass.');
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

const {
	getConfigurationErrorMessage,
	validateConfig,
} = require('./configuration');
const { getLocale, t } = require('./i18n');

function isGuildOwner(interaction) {
	return Boolean(
		interaction?.guild
		&& interaction.guild.ownerId
		&& interaction.user?.id
		&& interaction.guild.ownerId === interaction.user.id,
	);
}

function hasDmPermission(interaction, config) {
	return hasPrivilegedPermission(interaction, config, 'dm');
}

function hasModeratorPermission(interaction, config) {
	return hasPrivilegedPermission(interaction, config, 'moderator');
}

function canManageEntity(interaction, character, config) {
	return Boolean(
		character
		&& interaction?.user?.id
		&& (
			character.creatorId === interaction.user.id
			|| hasDmPermission(interaction, config)
		),
	);
}

function authorizeCommand(command, interaction, config) {
	const locale = getLocale(config);
	const metadata = command?.metadata ?? command;
	try {
		validateConfig(config);
	}
	catch (error) {
		return {
			allowed: false,
			message: getConfigurationErrorMessage(error, config),
		};
	}

	if (metadata?.guildOnly && !interaction?.guild) {
		return {
			allowed: false,
			message: t(locale, 'authorization.guildOnly'),
		};
	}

	const requiredPermission = metadata?.permission ?? 'everyone';
	const permissionChecks = {
		everyone: () => true,
		dm: hasDmPermission,
		moderator: hasModeratorPermission,
		owner: isGuildOwner,
	};
	const permissionCheck = permissionChecks[requiredPermission];
	if (!permissionCheck) {
		throw new Error(`Unknown command permission: ${requiredPermission}`);
	}
	if (!permissionCheck(interaction, config)) {
		const configuredRole = requiredPermission === 'dm'
			|| requiredPermission === 'moderator'
			? config.roles?.[requiredPermission]
			: null;
		return {
			allowed: false,
			message: requiredPermission === 'owner'
				? t(locale, 'authorization.ownerOnly')
				: configuredRole
					? t(locale, 'authorization.missingRole')
					: t(locale, `authorization.unconfiguredRole.${requiredPermission}`),
		};
	}
	return { allowed: true };
}

function hasPrivilegedPermission(interaction, config, roleKey) {
	if (!interaction?.guild) {
		return false;
	}
	if (isGuildOwner(interaction)) {
		return true;
	}
	try {
		validateConfig(config);
	}
	catch {
		return false;
	}
	return hasRole(interaction.member?.roles, config.roles?.[roleKey]);
}

function hasRole(memberRoles, roleId) {
	if (!roleId) {
		return false;
	}
	if (memberRoles?.cache?.has) {
		return memberRoles.cache.has(roleId);
	}
	if (memberRoles?.cache?.some) {
		return memberRoles.cache.some(role => role.id === roleId);
	}
	return Array.isArray(memberRoles) && memberRoles.includes(roleId);
}

module.exports = {
	authorizeCommand,
	canManageEntity,
	hasDmPermission,
	hasModeratorPermission,
	isGuildOwner,
};

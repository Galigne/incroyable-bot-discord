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
		&& interaction.guild.ownerId === interaction.user.id
	);
}

function hasDmPermission(interaction, config) {
	return hasPrivilegedPermission(interaction, config, 'dm');
}

function hasModeratorPermission(interaction, config) {
	return hasPrivilegedPermission(interaction, config, 'moderator');
}

function canManageCharacter(interaction, character, config) {
	return Boolean(
		character
		&& interaction?.user?.id
		&& (
			character.creatorId === interaction.user.id
			|| hasDmPermission(interaction, config)
		)
	);
}

function authorizeCommand(command, interaction, config) {
	const locale = getLocale(config);
	try {
		validateConfig(config);
	}
	catch (error) {
		return {
			allowed: false,
			message: getConfigurationErrorMessage(error, config),
		};
	}

	const requiredPermission = command?.access?.permission;
	if (!requiredPermission) {
		return { allowed: true };
	}
	if (!interaction?.guild) {
		return {
			allowed: false,
			message: t(locale, 'authorization.guildOnly'),
		};
	}

	const permissionChecks = {
		dm: hasDmPermission,
		moderator: hasModeratorPermission,
	};
	const permissionCheck = permissionChecks[requiredPermission];
	if (!permissionCheck) {
		throw new Error(`Unknown command permission: ${requiredPermission}`);
	}
	if (!permissionCheck(interaction, config)) {
		return {
			allowed: false,
			message: t(locale, 'authorization.missingRole'),
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
	return hasRole(interaction.member?.roles, config.roles[roleKey]);
}

function hasRole(memberRoles, roleId) {
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
	canManageCharacter,
	hasDmPermission,
	hasModeratorPermission,
	isGuildOwner,
};

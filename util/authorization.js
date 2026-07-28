const ROLE_GROUPS = {
	member: ['member', 'dm', 'moderator', 'owner'],
	dm: ['dm', 'owner'],
	moderator: ['moderator', 'owner'],
	owner: ['owner'],
};

function authorizeCommand(command, interaction, config) {
	const locale = getLocale(config, interaction.guildId);
	const requiredRole = command.access?.role ?? 'member';
	const allowedRoleKeys = ROLE_GROUPS[requiredRole];
	if (!allowedRoleKeys) {
		throw new Error(`Unknown command role: ${requiredRole}`);
	}

	const allowedRoleIds = allowedRoleKeys.map(role => config.roles[role]);
	const memberRoles = interaction.member?.roles;
	const hasAllowedRole = memberRoles?.cache
		? memberRoles.cache.some(role => allowedRoleIds.includes(role.id))
		: Array.isArray(memberRoles) && memberRoles.some(roleId => allowedRoleIds.includes(roleId));
	if (!hasAllowedRole) {
		return {
			allowed: false,
			message: t(locale, 'authorization.missingRole'),
		};
	}

	const channelKeys = command.access?.channels;
	if (channelKeys) {
		const allowedChannelIds = channelKeys.map(channel => config.channels[channel]);
		if (!allowedChannelIds.includes(interaction.channelId ?? interaction.channel?.id)) {
			return {
				allowed: false,
				message: t(locale, 'authorization.wrongChannel'),
			};
		}
	}

	return { allowed: true };
}

module.exports = { authorizeCommand };
const { getLocale, t } = require('./i18n');

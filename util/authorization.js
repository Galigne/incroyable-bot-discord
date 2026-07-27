const ROLE_GROUPS = {
	member: ['member', 'moderator', 'owner'],
	moderator: ['moderator', 'owner'],
	owner: ['owner'],
};

function authorizeCommand(command, message, config) {
	const requiredRole = command.access?.role ?? 'member';
	const allowedRoleKeys = ROLE_GROUPS[requiredRole];
	if (!allowedRoleKeys) {
		throw new Error(`Unknown command role: ${requiredRole}`);
	}

	const allowedRoleIds = allowedRoleKeys.map(role => config.roles[role]);
	const hasAllowedRole = message.member.roles.cache
		.some(role => allowedRoleIds.includes(role.id));
	if (!hasAllowedRole) {
		return {
			allowed: false,
			message: 'You do not have permission to use this command.',
		};
	}

	const channelKeys = command.access?.channels;
	if (channelKeys) {
		const allowedChannelIds = channelKeys.map(channel => config.channels[channel]);
		if (!allowedChannelIds.includes(message.channel.id)) {
			return {
				allowed: false,
				message: 'This command cannot be used in this channel.',
			};
		}
	}

	return { allowed: true };
}

module.exports = { authorizeCommand };

const { AttachmentBuilder, escapeMarkdown } = require('discord.js');
const { t } = require('./i18n');

const MAX_ACCESS_MESSAGE_LENGTH = 1_900;

function createEntityAccessListResponse(result, interaction, locale = 'en') {
	const header = t(locale, 'rpg.access.listTitle', { key: result.entityKey });
	const lines = result.access.length === 0
		? [t(locale, 'rpg.access.empty')]
		: result.access.map(entry => t(locale, 'rpg.access.listEntry', {
			level: t(locale, `rpg.access.levels.${entry.level}`),
			user: formatAccessUser(interaction, entry.userId),
		}));
	const content = [header, ...lines].join('\n');
	if (content.length <= MAX_ACCESS_MESSAGE_LENGTH) {
		return {
			allowedMentions: { users: [] },
			content,
		};
	}
	return {
		allowedMentions: { users: [] },
		content: t(locale, 'rpg.access.listAttached', { key: result.entityKey }),
		files: [new AttachmentBuilder(
			Buffer.from(content, 'utf8'),
			{ name: `access-${result.entityKey}.txt` },
		)],
	};
}

function createEntityAccessUpdateResponse(
	result,
	interaction,
	locale = 'en',
	providedUser = null,
) {
	return {
		allowedMentions: { users: [] },
		content: t(locale, result.changed
			? 'rpg.access.updated'
			: 'rpg.access.unchanged', {
			key: result.entityKey,
			level: t(locale, `rpg.access.levels.${result.level}`),
			previousLevel: t(locale, `rpg.access.levels.${result.previousLevel}`),
			user: formatAccessUser(interaction, result.userId, providedUser),
		}),
	};
}

function formatAccessUser(interaction, userId, providedUser = null) {
	const member = interaction.guild?.members?.cache?.get?.(userId);
	const user = providedUser
		?? member?.user
		?? interaction.client?.users?.cache?.get?.(userId);
	const displayName = member?.displayName
		?? user?.globalName
		?? user?.tag
		?? user?.username;
	const mention = `<@${userId}>`;
	return displayName
		? `${mention} (${escapeMarkdown(displayName)} · \`${userId}\`)`
		: `${mention} (\`${userId}\`)`;
}

module.exports = {
	createEntityAccessListResponse,
	createEntityAccessUpdateResponse,
	formatAccessUser,
};

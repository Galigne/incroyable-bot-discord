const {
	getEntityAccess,
	updateEntityAccess,
} = require('../../services/entityApplicationService');
const { resolveEntityAccessRequest } = require('../../services/entityAccess');
const { hasFullEntityAuthority } = require('../../util/authorization');
const { replyToEntityError } = require('../../util/entityCommandErrors');
const {
	createEntityAccessListResponse,
	createEntityAccessUpdateResponse,
} = require('../../util/entityAccessResponses');
const { getLocale } = require('../../util/i18n');

module.exports = {
	async execute({ config, interaction }) {
		const locale = getLocale(config);
		const entityKey = interaction.options.getString('entity-key', true);
		const user = interaction.options.getUser('user');
		const rawUserId = interaction.options.getString('user-id');
		const level = interaction.options.getString('level');
		try {
			const request = resolveEntityAccessRequest({
				level,
				rawUserId,
				selectedUserId: user?.id,
			});
			if (request.kind === 'list') {
				const result = await getEntityAccess(entityKey);
				await interaction.reply(createEntityAccessListResponse(
					result,
					interaction,
					locale,
				));
				return;
			}
			const result = await updateEntityAccess(
				entityKey,
				request.userId,
				request.level,
				entity => hasFullEntityAuthority(interaction, entity, config),
			);
			await interaction.reply(createEntityAccessUpdateResponse(
				result,
				interaction,
				locale,
				user,
			));
		}
		catch (error) {
			if (!await replyToEntityError(interaction, error, locale)) {
				throw error;
			}
		}
	},
};

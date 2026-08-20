const {
	getEntityAccess,
	updateEntityAccess,
} = require('../../services/entityApplicationService');
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
		const level = interaction.options.getString('level');
		try {
			if (!user && !level) {
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
				user?.id,
				level,
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

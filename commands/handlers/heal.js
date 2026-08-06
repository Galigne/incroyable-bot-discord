const { healEntity } = require('../../services/entityApplicationService');
const { canManageEntity } = require('../../util/authorization');
const { createEntityHealResponse } = require('../../util/entityCommandResponses');
const { replyToEntityError } = require('../../util/entityCommandErrors');
const { createEntityHistoryContext } = require('../../util/entityHistoryContext');
const { getLocale } = require('../../util/i18n');

module.exports = {
	async execute({ config, interaction }) {
		const locale = getLocale(config);
		const entityKey = interaction.options.getString('entity-key', true);
		const resource = interaction.options.getString('resource', true);
		const percentage = interaction.options.getNumber('percentage', true);
		try {
			const result = await healEntity(
				entityKey,
				resource,
				percentage,
				entity => canManageEntity(interaction, entity, config),
				createEntityHistoryContext(interaction, config),
			);
			await interaction.reply(createEntityHealResponse(result, locale));
		}
		catch (error) {
			if (!await replyToEntityError(interaction, error, locale)) {
				throw error;
			}
		}
	},
};

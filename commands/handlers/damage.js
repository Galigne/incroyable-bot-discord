const { damageEntity } = require('../../services/entityApplicationService');
const { canManageEntity } = require('../../util/authorization');
const { createEntityDamageResponse } = require('../../util/entityCommandResponses');
const { replyToEntityError } = require('../../util/entityCommandErrors');
const { createEntityHistoryContext } = require('../../util/entityHistoryContext');
const { getLocale } = require('../../util/i18n');

module.exports = {
	async execute({ config, interaction }) {
		const locale = getLocale(config);
		const entityKey = interaction.options.getString('entity-key', true);
		const damageAmount = interaction.options.getInteger('damage-amount', true);
		const piercing = interaction.options.getBoolean('piercing') ?? false;
		try {
			const result = await damageEntity(
				entityKey,
				damageAmount,
				piercing,
				entity => canManageEntity(interaction, entity, config),
				createEntityHistoryContext(interaction, config),
			);
			await interaction.reply(createEntityDamageResponse(result, locale));
		}
		catch (error) {
			if (!await replyToEntityError(interaction, error, locale)) {
				throw error;
			}
		}
	},
};

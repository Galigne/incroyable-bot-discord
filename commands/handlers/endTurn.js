const { endEntityTurn } = require('../../services/entityApplicationService');
const { canManageEntity } = require('../../util/authorization');
const { createEndEntityTurnResponse } = require('../../util/entityCommandResponses');
const { replyToEntityError } = require('../../util/entityCommandErrors');
const { createEntityHistoryContext } = require('../../util/entityHistoryContext');
const { getLocale } = require('../../util/i18n');

module.exports = {
	async execute({ config, interaction }) {
		const locale = getLocale(config, interaction.guildId);
		const entityKey = interaction.options.getString('entity-key', true);
		try {
			const result = await endEntityTurn(
				entityKey,
				entity => canManageEntity(interaction, entity, config),
				createEntityHistoryContext(interaction, config),
			);
			await interaction.reply(createEndEntityTurnResponse(result, locale));
		}
		catch (error) {
			if (!await replyToEntityError(interaction, error, locale)) {
				throw error;
			}
		}
	},
};

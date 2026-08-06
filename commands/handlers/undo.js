const { undoEntity } = require('../../services/entityApplicationService');
const { canManageEntity } = require('../../util/authorization');
const { replyToEntityError } = require('../../util/entityCommandErrors');
const { createEntityHistoryContext } = require('../../util/entityHistoryContext');
const { createEntityUndoResponse } = require('../../util/entityCommandResponses');

module.exports = {
	async execute({ config, interaction, locale }) {
		const entityKey = interaction.options.getString('entity-key', true);
		try {
			const result = await undoEntity(
				entityKey,
				entity => canManageEntity(interaction, entity, config),
				createEntityHistoryContext(interaction, config),
			);
			await interaction.reply(createEntityUndoResponse(result, locale));
		}
		catch (error) {
			if (!await replyToEntityError(interaction, error, locale)) {
				throw error;
			}
		}
	},
};

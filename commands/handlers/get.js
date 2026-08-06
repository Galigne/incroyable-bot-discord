const { getEntity } = require('../../services/entityApplicationService');
const { createEntityGetResponse } = require('../../util/entityCommandResponses');
const { replyToEntityError } = require('../../util/entityCommandErrors');
const { getLocale } = require('../../util/i18n');

module.exports = {
	async execute({ config, interaction }) {
		const locale = getLocale(config);
		const entityKey = interaction.options.getString('entity-key', true);
		const fieldName = interaction.options.getString('field');
		try {
			const entity = await getEntity(entityKey);
			await interaction.reply(createEntityGetResponse(entity, fieldName, locale));
		}
		catch (error) {
			if (!await replyToEntityError(interaction, error, locale)) {
				throw error;
			}
		}
	},
};

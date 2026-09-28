const { getEntity } = require('../../services/entityApplicationService');
const { createEntityGetResponses } = require('../../util/entityCommandResponses');
const { replyToEntityError } = require('../../util/entityCommandErrors');
const { getLocale } = require('../../util/i18n');

module.exports = {
	async execute({ config, interaction }) {
		const locale = getLocale(config);
		const entityKey = interaction.options.getString('entity-key', true);
		const fieldName = interaction.options.getString('field');
		try {
			const entity = await getEntity(entityKey);
			const responses = createEntityGetResponses(entity, fieldName, locale);
			await interaction.reply(responses[0]);
			for (const response of responses.slice(1)) {
				await interaction.followUp(response);
			}
		}
		catch (error) {
			if (!await replyToEntityError(interaction, error, locale)) {
				throw error;
			}
		}
	},
};

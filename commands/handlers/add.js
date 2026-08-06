const { createEntity } = require('../../services/entityApplicationService');
const { createEntityAddedResponse } = require('../../util/entityCommandResponses');
const { replyToEntityError } = require('../../util/entityCommandErrors');
const { getLocale } = require('../../util/i18n');

module.exports = {
	async execute({ config, interaction }) {
		const locale = getLocale(config);
		const entityKey = interaction.options.getString('entity-key', true);
		const type = interaction.options.getString('type') ?? 'character';
		try {
			const entity = await createEntity(entityKey, type, interaction.user.id);
			await interaction.reply(createEntityAddedResponse(entity, locale));
		}
		catch (error) {
			if (!await replyToEntityError(interaction, error, locale)) {
				throw error;
			}
		}
	},
};

const {
	healCharacter,
} = require('../../../services/characterApplicationService');
const { canManageCharacter } = require('../../../util/authorization');
const {
	createCharacterHealResponse,
} = require('../../../util/characterCommandResponses');
const { replyToCharacterError } = require('../../../util/characterCommandErrors');
const {
	createCharacterHistoryContext,
} = require('../../../util/characterHistoryContext');
const { getLocale } = require('../../../util/i18n');

module.exports = {
	async execute({ config, interaction }) {
		const locale = getLocale(config, interaction.guildId);
		const characterName = interaction.options.getString('character-key', true);
		const resource = interaction.options.getString('resource', true);
		const percentage = interaction.options.getNumber('percentage', true);
		try {
			const result = await healCharacter(
				characterName,
				resource,
				percentage,
				currentCharacter => canManageCharacter(interaction, currentCharacter, config),
				createCharacterHistoryContext(interaction, config),
			);
			await interaction.reply(createCharacterHealResponse(result, locale));
		}
		catch (error) {
			if (!await replyToCharacterError(interaction, error, locale)) {
				throw error;
			}
		}
	},
};

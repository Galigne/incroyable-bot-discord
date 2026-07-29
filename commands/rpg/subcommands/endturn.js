const {
	endCharacterTurn,
} = require('../../../services/characterApplicationService');
const { canManageCharacter } = require('../../../util/authorization');
const {
	createEndTurnResponse,
} = require('../../../util/characterCommandResponses');
const { replyToCharacterError } = require('../../../util/characterCommandErrors');
const { getLocale } = require('../../../util/i18n');

module.exports = {
	async execute({ config, interaction }) {
		const locale = getLocale(config, interaction.guildId);
		const characterName = interaction.options.getString('character-key', true);
		try {
			const result = await endCharacterTurn(
				characterName,
				currentCharacter => canManageCharacter(interaction, currentCharacter, config),
			);
			await interaction.reply(createEndTurnResponse(result, locale));
		}
		catch (error) {
			if (!await replyToCharacterError(interaction, error, locale)) {
				throw error;
			}
		}
	},
};

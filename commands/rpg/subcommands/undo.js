const {
	undoCharacter,
} = require('../../../services/characterApplicationService');
const { canManageCharacter } = require('../../../util/authorization');
const { replyToCharacterError } = require('../../../util/characterCommandErrors');
const {
	createCharacterHistoryContext,
} = require('../../../util/characterHistoryContext');
const {
	createCharacterUndoResponse,
} = require('../../../util/characterCommandResponses');

module.exports = {
	async execute({ config, interaction, locale }) {
		const characterKey = interaction.options.getString('character-key', true);
		try {
			const result = await undoCharacter(
				characterKey,
				character => canManageCharacter(interaction, character, config),
				createCharacterHistoryContext(interaction, config),
			);
			await interaction.reply(createCharacterUndoResponse(result, locale));
		}
		catch (error) {
			if (!await replyToCharacterError(interaction, error, locale)) {
				throw error;
			}
		}
	},
};

const {
	deleteCharacter,
} = require('../../../services/characterApplicationService');
const { canManageCharacter } = require('../../../util/authorization');
const {
	createCharacterDeletedResponse,
} = require('../../../util/characterCommandResponses');
const { replyToCharacterError } = require('../../../util/characterCommandErrors');
const { getLocale } = require('../../../util/i18n');

module.exports = {
	async execute({ config, interaction }) {
		const locale = getLocale(config, interaction.guildId);
		const name = interaction.options.getString('character-key', true);
		try {
			await deleteCharacter(
				name,
				character => canManageCharacter(interaction, character, config),
			);
			await interaction.reply(createCharacterDeletedResponse(name, locale));
		}
		catch (error) {
			if (!await replyToCharacterError(interaction, error, locale)) {
				throw error;
			}
		}
	},
};

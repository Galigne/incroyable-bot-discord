const {
	createCharacter,
} = require('../../../services/characterApplicationService');
const {
	createCharacterAddedResponse,
} = require('../../../util/characterCommandResponses');
const { replyToCharacterError } = require('../../../util/characterCommandErrors');
const { getLocale } = require('../../../util/i18n');

module.exports = {
	async execute({ config, interaction }) {
		const locale = getLocale(config, interaction.guildId);
		const characterKey = interaction.options.getString('character-key', true);
		try {
			await createCharacter(characterKey, interaction.user.id);
			await interaction.reply(createCharacterAddedResponse(characterKey, locale));
		}
		catch (error) {
			if (!await replyToCharacterError(interaction, error, locale)) {
				throw error;
			}
		}
	},
};

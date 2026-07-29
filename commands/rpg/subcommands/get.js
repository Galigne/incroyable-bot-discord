const {
	getCharacter,
} = require('../../../services/characterApplicationService');
const { getLocale } = require('../../../util/i18n');
const {
	createCharacterGetResponse,
} = require('../../../util/characterCommandResponses');
const { replyToCharacterError } = require('../../../util/characterCommandErrors');

module.exports = {
	async execute({ config, interaction }) {
		const locale = getLocale(config, interaction.guildId);
		const name = interaction.options.getString('character-key', true);
		const fieldName = interaction.options.getString('field');
		try {
			const character = await getCharacter(name);
			await interaction.reply(
				createCharacterGetResponse(character, name, fieldName, locale),
			);
		}
		catch (error) {
			if (!await replyToCharacterError(interaction, error, locale)) {
				throw error;
			}
		}
	},
};

const {
	generateCharacter,
} = require('../../services/characterApplicationService');
const {
	createGeneratedCharacterResponse,
} = require('../../util/characterCommandResponses');
const {
	createLocalizedCharacterGenerationOptions,
} = require('../../util/characterGenerationLocalization');
const { replyToCharacterError } = require('../../util/characterCommandErrors');
const { getLocale } = require('../../util/i18n');

module.exports = {
	async execute({ config, interaction }) {
		const locale = getLocale(config, interaction.guildId);
		const characterKey = interaction.options.getString('character-key', true);
		const level = interaction.options.getInteger('level');
		const background = interaction.options.getString('background');
		try {
			const character = await generateCharacter(
				characterKey,
				interaction.user.id,
				createLocalizedCharacterGenerationOptions({ background, level }, locale),
			);
			await interaction.reply(createGeneratedCharacterResponse(character, locale));
		}
		catch (error) {
			if (!await replyToCharacterError(interaction, error, locale)) {
				throw error;
			}
		}
	},
};

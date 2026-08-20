const {
	generateCharacter,
} = require('../../services/characterApplicationService');
const {
	createGeneratedCharacterResponse,
	createGeneratedCharacterFollowUpResponses,
} = require('../../util/characterCommandResponses');
const {
	createLocalizedCharacterGenerationOptions,
} = require('../../util/characterGenerationLocalization');
const { replyToCharacterError } = require('../../util/characterCommandErrors');
const { getLocale } = require('../../util/i18n');

module.exports = {
	async execute({ config, interaction }) {
		const locale = getLocale(config);
		const characterKey = interaction.options.getString('character-key', true);
		const level = interaction.options.getInteger('level');
		// discord.js returns null for an omitted optional string option. The
		// generator uses undefined to distinguish omission from an invalid value.
		const background = interaction.options.getString('background') ?? undefined;
		try {
			const character = await generateCharacter(
				characterKey,
				createLocalizedCharacterGenerationOptions({ background, level }, locale),
			);
			await interaction.reply(createGeneratedCharacterResponse(character, locale));
			for (const response of createGeneratedCharacterFollowUpResponses(character, locale)) {
				await interaction.followUp(response);
			}
		}
		catch (error) {
			if (!await replyToCharacterError(interaction, error, locale)) {
				throw error;
			}
		}
	},
};

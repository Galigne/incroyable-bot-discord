const {
	damageCharacter,
} = require('../../../services/characterApplicationService');
const { canManageCharacter } = require('../../../util/authorization');
const {
	createCharacterDamageResponse,
} = require('../../../util/characterCommandResponses');
const { replyToCharacterError } = require('../../../util/characterCommandErrors');
const {
	createCharacterHistoryContext,
} = require('../../../util/characterHistoryContext');
const { getLocale } = require('../../../util/i18n');

module.exports = {
	async execute({ config, interaction }) {
		const locale = getLocale(config, interaction.guildId);
		const characterKey = interaction.options.getString('character-key', true);
		const damageAmount = interaction.options.getInteger('damage-amount', true);
		const piercing = interaction.options.getBoolean('piercing') ?? false;

		try {
			const result = await damageCharacter(
				characterKey,
				damageAmount,
				piercing,
				currentCharacter => canManageCharacter(interaction, currentCharacter, config),
				createCharacterHistoryContext(interaction, config),
			);
			await interaction.reply(createCharacterDamageResponse(result, locale));
		}
		catch (error) {
			if (!await replyToCharacterError(interaction, error, locale)) {
				throw error;
			}
		}
	},
};

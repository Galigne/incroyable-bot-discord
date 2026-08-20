const {
	generateCreature,
} = require('../../services/creatureApplicationService');
const {
	createGeneratedCreatureResponse,
	createGeneratedCreatureFollowUpResponses,
} = require('../../util/entityCommandResponses');
const { replyToEntityError } = require('../../util/entityCommandErrors');
const { getLocale } = require('../../util/i18n');

module.exports = {
	async execute({ config, interaction }) {
		const locale = getLocale(config);
		const entityKey = interaction.options.getString('creature-key', true);
		// discord.js returns null for an omitted optional string option. The
		// generator uses undefined to distinguish omission from an invalid value.
		const type = interaction.options.getString('type') ?? undefined;
		const level = interaction.options.getInteger('level');
		try {
			const creature = await generateCreature(
				entityKey,
				{ type, level, locale },
			);
			await interaction.reply(createGeneratedCreatureResponse(creature, locale));
			for (const response of createGeneratedCreatureFollowUpResponses(creature, locale)) {
				await interaction.followUp(response);
			}
		}
		catch (error) {
			if (!await replyToEntityError(interaction, error, locale)) {
				throw error;
			}
		}
	},
};

const {
	generateCreature,
} = require('../../services/creatureApplicationService');
const {
	createGeneratedCreatureResponse,
} = require('../../util/entityCommandResponses');
const { replyToEntityError } = require('../../util/entityCommandErrors');
const { getLocale } = require('../../util/i18n');

module.exports = {
	async execute({ config, interaction }) {
		const locale = getLocale(config, interaction.guildId);
		const entityKey = interaction.options.getString('creature-key', true);
		const archetype = interaction.options.getString('type', true);
		const level = interaction.options.getInteger('level');
		try {
			const creature = await generateCreature(
				entityKey,
				interaction.user.id,
				{ archetype, level, locale },
			);
			await interaction.reply(createGeneratedCreatureResponse(creature, locale));
		}
		catch (error) {
			if (!await replyToEntityError(interaction, error, locale)) {
				throw error;
			}
		}
	},
};

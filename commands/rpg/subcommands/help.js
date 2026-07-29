const { createRpgHelpResponse } = require('../../../util/helpResponses');
const { getLocale } = require('../../../util/i18n');

module.exports = {
	async execute({ config, interaction, registry }) {
		const locale = getLocale(config, interaction.guildId);
		await interaction.reply(createRpgHelpResponse(
			registry.getHelpMetadata('rpg').filter(metadata => metadata.parent === 'rpg'),
			locale,
		));
	},
};

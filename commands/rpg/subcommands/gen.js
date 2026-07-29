const generatorCatalog = require('../../../services/generatorCatalog');
const { createGeneratorResponse } = require('../../../util/generatorResponses');
const { getLocale } = require('../../../util/i18n');

module.exports = {
	async execute({ config, interaction }) {
		const locale = getLocale(config, interaction.guildId);
		const requestedCategory = interaction.options.getString('category', true);
		const result = generatorCatalog.generate(requestedCategory, locale);
		await interaction.reply(createGeneratorResponse(result, requestedCategory, locale));
	},
};

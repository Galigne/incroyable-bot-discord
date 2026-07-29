const generatorCatalog = require('../../../services/generatorCatalog');
const {
	createGeneratorHelpResponse,
} = require('../../../util/generatorResponses');
const { getLocale } = require('../../../util/i18n');

module.exports = {
	async execute({ config, interaction }) {
		const locale = getLocale(config, interaction.guildId);
		const categories = generatorCatalog.listGenerators(locale);
		await interaction.reply(createGeneratorHelpResponse(categories, locale));
	},
};

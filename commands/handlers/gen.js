const {
	generateGeneratorResults,
} = require('../../services/generatorApplicationService');
const {
	createGeneratorResultsResponse,
} = require('../../util/generatorResponses');
const { getLocale } = require('../../util/i18n');

module.exports = {
	async execute({ config, interaction }) {
		const locale = getLocale(config);
		const requestedCategory = interaction.options.getString('category', true);
		const requestedCount = interaction.options.getInteger('count') ?? 1;
		const results = generateGeneratorResults(requestedCategory, locale, {
			count: requestedCount,
		});
		await interaction.reply(createGeneratorResultsResponse(
			results,
			requestedCategory,
			locale,
		));
	},
};

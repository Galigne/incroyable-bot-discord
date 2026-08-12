const {
	generateGeneratorResults,
} = require('../../services/generatorApplicationService');
const {
	createGeneratorResponse,
	createGeneratorResultsResponse,
} = require('../../util/generatorResponses');
const { getLocale } = require('../../util/i18n');

module.exports = {
	async execute({ config, interaction }) {
		const locale = getLocale(config);
		const requestedCategory = interaction.options.getString('category', true);
		const requestedCount = interaction.options.getInteger('count') ?? 1;
		const requestedModifier = interaction.options.getString('modifier');
		try {
			const results = generateGeneratorResults(requestedCategory, locale, {
				count: requestedCount,
				modifier: requestedModifier ?? undefined,
			});
			await interaction.reply(createGeneratorResultsResponse(
				results,
				requestedCategory,
				locale,
				requestedModifier,
			));
		}
		catch (error) {
			if (error.code !== 'GENERATOR_MODIFIER_INVALID') {
				throw error;
			}
			await interaction.reply(createGeneratorResponse(
				null,
				requestedCategory,
				locale,
				requestedModifier,
			));
		}
	},
};

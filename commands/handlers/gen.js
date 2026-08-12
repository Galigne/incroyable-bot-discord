const generatorResolver = require('../../services/generatorResolver');
const { createGeneratorResponse } = require('../../util/generatorResponses');
const { getLocale } = require('../../util/i18n');

module.exports = {
	async execute({ config, interaction }) {
		const locale = getLocale(config);
		const requestedCategory = interaction.options.getString('category', true);
		const requestedModifier = interaction.options.getString('modifier');
		try {
			const result = generatorResolver.generate(requestedCategory, locale, {
				modifier: requestedModifier ?? undefined,
			});
			await interaction.reply(createGeneratorResponse(
				result,
				requestedCategory,
				locale,
				result ? requestedModifier : undefined,
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

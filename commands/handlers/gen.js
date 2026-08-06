const generatorResolver = require('../../services/generatorResolver');
const { createGeneratorResponse } = require('../../util/generatorResponses');
const { getLocale } = require('../../util/i18n');

module.exports = {
	async execute({ config, interaction }) {
		const locale = getLocale(config);
		const requestedCategory = interaction.options.getString('category', true);
		const result = generatorResolver.generate(requestedCategory, locale);
		await interaction.reply(createGeneratorResponse(result, requestedCategory, locale));
	},
};

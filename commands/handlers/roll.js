const { createDiceRollResponse } = require('../../util/diceRollResponse');
const { getLocale } = require('../../util/i18n');

module.exports = {
	async execute({ config, interaction }) {
		const locale = getLocale(config);
		const expression = interaction.options.getString('expression', true);
		await interaction.reply(createDiceRollResponse(expression, locale));
	},
};

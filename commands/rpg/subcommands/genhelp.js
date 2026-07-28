const generatorCatalog = require('../../../services/generatorCatalog');
const {
	createGeneratorHelpResponse,
} = require('../../../util/generatorResponses');
const { getLocale, localizeDescription, t } = require('../../../util/i18n');

const descriptionKey = 'rpg.genHelp.description';

module.exports = {
	name: 'gen-help',
	description: t('en', descriptionKey),
	descriptionKey,
	usage: '/rpg gen-help',
	helpOrder: 12,
	configure: command => localizeDescription(
		command.setName('gen-help'),
		'rpg.genHelp.schemaDescription',
	),
	async execute({ config, interaction }) {
		const locale = getLocale(config, interaction.guildId);
		const categories = generatorCatalog.listGenerators(locale);
		await interaction.reply(createGeneratorHelpResponse(categories, locale));
	},
};

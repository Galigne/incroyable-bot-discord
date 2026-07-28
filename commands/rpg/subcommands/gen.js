const generatorCatalog = require('../../../services/generatorCatalog');
const { filterAutocompleteChoices } = require('../../../util/autocomplete');
const { createGeneratorResponse } = require('../../../util/generatorResponses');
const { getLocale, localizeDescription, t } = require('../../../util/i18n');

const descriptionKey = 'rpg.gen.description';

module.exports = {
	name: 'gen',
	description: t('en', descriptionKey),
	descriptionKey,
	usage: '/rpg gen category:<category>',
	helpOrder: 10,
	access: {
		permission: 'dm',
	},
	configure: command => localizeDescription(
		command.setName('gen'),
		'rpg.gen.schemaDescription',
	)
		.addStringOption(option => localizeDescription(
			option.setName('category'),
			'rpg.gen.categoryOption',
		)
			.setAutocomplete(true)
			.setRequired(true)),
	async autocomplete({ config, interaction }) {
		const locale = getLocale(config, interaction.guildId);
		const categories = generatorCatalog.listGenerators(locale);
		await interaction.respond(filterAutocompleteChoices(
			categories.map(category => ({
				name: `${category.name} — ${category.description}`.slice(0, 100),
				value: category.id,
			})),
			interaction.options.getFocused(),
		));
	},
	async execute({ config, interaction }) {
		const locale = getLocale(config, interaction.guildId);
		const requestedCategory = interaction.options.getString('category', true);
		const result = generatorCatalog.generate(requestedCategory, locale);
		await interaction.reply(createGeneratorResponse(result, requestedCategory, locale));
	},
};

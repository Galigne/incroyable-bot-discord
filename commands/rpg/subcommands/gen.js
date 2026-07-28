const { EmbedBuilder, MessageFlags } = require('discord.js');
const generatorCatalog = require('../../../services/generatorCatalog');
const { filterAutocompleteChoices } = require('../../../util/autocomplete');
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
		if (!result) {
			await interaction.reply({
				content: t(locale, 'rpg.gen.unknownCategory', {
					category: requestedCategory,
				}),
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const embed = createGeneratedEmbed(result, locale);
		await interaction.reply({ embeds: [embed] });
	},
};

function createGeneratedEmbed(result, locale = 'en') {
	const embed = new EmbedBuilder()
		.setTitle(t(locale, 'rpg.gen.title', { category: result.category.name }))
		.setColor('#FFD700')
		.setFooter({ text: t(locale, 'rpg.gen.footer') });
	if (typeof result.entry === 'string' || result.entry.value !== undefined) {
		embed.setDescription(
			typeof result.entry === 'string' ? result.entry : result.entry.value,
		);
	}
	else {
		embed.addFields(
			Object.entries(result.entry.fields).map(([name, value]) => ({
				name: getGeneratorFieldLabel(name, locale),
				value: String(value),
			})),
		);
	}
	return embed;
}

const GENERATOR_FIELD_KEYS = {
	'AR percentage': 'arPercentage',
	Allies: 'allies',
	Appearance: 'appearance',
	Backstory: 'backstory',
	Commandment: 'commandment',
	'Constitution requirement': 'constitutionRequirement',
	'Deity or Belief': 'deityOrBelief',
	Description: 'description',
	Encumbrance: 'encumbrance',
	Enemies: 'enemies',
	FirstName: 'firstName',
	Generator: 'generator',
	Goal: 'goal',
	Goals: 'goals',
	Hierarchy: 'hierarchy',
	'Holy Place': 'holyPlace',
	LastName: 'lastName',
	Leadership: 'leadership',
	Name: 'name',
	'Physical Ability': 'physicalAbility',
	Rarity: 'rarity',
	'Relationship with Magic': 'relationshipWithMagic',
	'Religious Order': 'religiousOrder',
	Resources: 'resources',
	Rites: 'rites',
	'Sacred Symbol': 'sacredSymbol',
	'Skill Bonus': 'skillBonus',
	Strength: 'strength',
	Structure: 'structure',
	Taboo: 'taboo',
	Tension: 'tension',
	Type: 'type',
};

function getGeneratorFieldLabel(field, locale) {
	const key = GENERATOR_FIELD_KEYS[field];
	return key ? t(locale, `generatorFields.${key}`) : field;
}

module.exports.createGeneratedEmbed = createGeneratedEmbed;

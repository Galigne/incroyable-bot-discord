const {
	InteractionContextType,
	MessageFlags,
	SlashCommandBuilder,
} = require('discord.js');
const { filterAutocompleteChoices } = require('../util/autocomplete');
const { getLocale, localizeDescription, t } = require('../util/i18n');

const COMMON_PURGE_AMOUNTS = [2, 5, 10, 25, 50, 100];
const descriptionKey = 'commands.purge.description';

module.exports = {
	name: 'purge',
	description: t('en', descriptionKey),
	descriptionKey,
	usage: '/purge amount:<2-100>',
	helpOrder: 60,
	access: {
		role: 'owner',
	},
	data: localizeDescription(new SlashCommandBuilder()
		.setName('purge')
		.setContexts(InteractionContextType.Guild), descriptionKey)
		.addIntegerOption(option => localizeDescription(
			option.setName('amount'),
			'commands.purge.amount',
		)
			.setMinValue(2)
			.setMaxValue(100)
			.setAutocomplete(true)
			.setRequired(true)),
	async autocomplete({ interaction }) {
		const focused = interaction.options.getFocused();
		await interaction.respond(filterAutocompleteChoices(
			COMMON_PURGE_AMOUNTS.map(value => ({ name: String(value), value })),
			focused,
		));
	},
	async execute({ config, interaction }) {
		const locale = getLocale(config, interaction.guildId);
		const deleteCount = interaction.options.getInteger('amount', true);
		const deleted = await interaction.channel.bulkDelete(deleteCount, true);
		await interaction.reply({
			content: t(locale, 'commands.purge.success', { count: deleted.size }),
			flags: MessageFlags.Ephemeral,
		});
	},
};

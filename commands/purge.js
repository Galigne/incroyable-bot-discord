const {
	InteractionContextType,
	MessageFlags,
	SlashCommandBuilder,
} = require('discord.js');
const { filterAutocompleteChoices } = require('../util/autocomplete');

const COMMON_PURGE_AMOUNTS = [2, 5, 10, 25, 50, 100];

module.exports = {
	name: 'purge',
	description: 'Delete recent messages from the current channel',
	usage: '/purge amount:<2-100>',
	helpOrder: 60,
	access: {
		role: 'owner',
	},
	data: new SlashCommandBuilder()
		.setName('purge')
		.setDescription('Delete recent messages from the current channel')
		.setContexts(InteractionContextType.Guild)
		.addIntegerOption(option => option
			.setName('amount')
			.setDescription('Number of recent messages to delete')
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
	async execute({ interaction }) {
		const deleteCount = interaction.options.getInteger('amount', true);
		const deleted = await interaction.channel.bulkDelete(deleteCount, true);
		await interaction.reply({
			content: `Deleted ${deleted.size} recent messages.`,
			flags: MessageFlags.Ephemeral,
		});
	},
};

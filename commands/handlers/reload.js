const { MessageFlags } = require('discord.js');
const { t } = require('../../util/i18n');
const { createReloadSummary } = require('../../util/reloadResponses');

module.exports = {
	async execute({ interaction, locale, runtimeReloader }) {
		await interaction.reply({
			content: t(locale, 'commands.reload.started'),
			flags: MessageFlags.Ephemeral,
		});
		const outcome = await runtimeReloader.reload();
		await interaction.editReply({
			content: createReloadSummary(outcome),
		});
	},
};

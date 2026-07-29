const { MessageFlags } = require('discord.js');
const { getLocale, t } = require('../util/i18n');

module.exports = {
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

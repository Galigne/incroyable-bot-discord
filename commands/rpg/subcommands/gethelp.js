const { MessageFlags } = require('discord.js');
const { getLocale, t } = require('../../../util/i18n');

module.exports = {
	async execute({ config, interaction }) {
		await interaction.reply({
			content: t(getLocale(config, interaction.guildId), 'rpg.getHelp.body'),
			flags: MessageFlags.Ephemeral,
		});
	},
};

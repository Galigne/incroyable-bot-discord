const { MessageFlags } = require('discord.js');
const { getLocale, localizeDescription, t } = require('../../../util/i18n');

const descriptionKey = 'rpg.getHelp.description';

module.exports = {
	name: 'get-help',
	description: t('en', descriptionKey),
	descriptionKey,
	usage: '/rpg get-help',
	helpOrder: 35,
	configure: command => localizeDescription(command.setName('get-help'), descriptionKey),
	async execute({ config, interaction }) {
		await interaction.reply({
			content: t(getLocale(config, interaction.guildId), 'rpg.getHelp.body'),
			flags: MessageFlags.Ephemeral,
		});
	},
};

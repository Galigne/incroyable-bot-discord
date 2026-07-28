const { MessageFlags } = require('discord.js');
const { getLocale, localizeDescription, t } = require('../../../util/i18n');

const descriptionKey = 'rpg.setHelp.description';

module.exports = {
	name: 'set-help',
	description: t('en', descriptionKey),
	descriptionKey,
	usage: '/rpg set-help',
	helpOrder: 45,
	configure: command => localizeDescription(command.setName('set-help'), descriptionKey),
	async execute({ config, interaction }) {
		await interaction.reply({
			content: t(getLocale(config, interaction.guildId), 'rpg.setHelp.body'),
			flags: MessageFlags.Ephemeral,
		});
	},
};

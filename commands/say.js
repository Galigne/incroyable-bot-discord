const {
	InteractionContextType,
	SlashCommandBuilder,
} = require('discord.js');
const { localizeDescription, t } = require('../util/i18n');

const descriptionKey = 'commands.say.description';

module.exports = {
	name: 'say',
	description: t('en', descriptionKey),
	descriptionKey,
	usage: '/say message:<text>',
	helpOrder: 50,
	access: {
		permission: 'moderator',
	},
	data: localizeDescription(new SlashCommandBuilder()
		.setName('say')
		.setContexts(InteractionContextType.Guild), descriptionKey)
		.addStringOption(option => localizeDescription(
			option.setName('message'),
			'commands.say.message',
		)
			.setMaxLength(2_000)
			.setRequired(true)),
	async execute({ interaction }) {
		await interaction.reply(interaction.options.getString('message', true));
	},
};

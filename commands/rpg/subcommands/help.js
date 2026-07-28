const { createRpgHelpResponse } = require('../../../util/helpResponses');
const { getLocale, localizeDescription, t } = require('../../../util/i18n');

const descriptionKey = 'rpg.help.description';

module.exports = {
	name: 'help',
	description: t('en', descriptionKey),
	descriptionKey,
	usage: '/rpg help',
	helpOrder: 90,
	configure: command => localizeDescription(command.setName('help'), descriptionKey),
	async execute({ config, interaction }) {
		const locale = getLocale(config, interaction.guildId);
		const rpgCommand = interaction.client.commands.get('rpg');
		await interaction.reply(createRpgHelpResponse(
			rpgCommand.subcommands.values(),
			locale,
		));
	},
};

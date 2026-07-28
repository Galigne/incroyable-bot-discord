const { MessageFlags } = require('discord.js');
const characterStore = require('../../../services/characterStore');
const { getLocale, localizeDescription, t } = require('../../../util/i18n');

const descriptionKey = 'rpg.add.description';

module.exports = {
	name: 'add',
	description: t('en', descriptionKey),
	descriptionKey,
	usage: '/rpg add character-key:<new key>',
	helpOrder: 20,
	configure: command => localizeDescription(command.setName('add'), descriptionKey)
		.addStringOption(option => localizeDescription(
			option.setName('character-key'),
			'rpg.add.keyOption',
		)
			.setMinLength(1)
			.setMaxLength(50)
			.setRequired(true)),
	async execute({ config, interaction }) {
		const locale = getLocale(config, interaction.guildId);
		const characterKey = interaction.options.getString('character-key', true);
		try {
			await characterStore.createCharacter(characterKey, interaction.user.id);
			await interaction.reply(t(locale, 'rpg.add.success', { key: characterKey }));
		}
		catch (error) {
			if (error.code === 'EEXIST') {
				await interaction.reply({
					content: t(locale, 'errors.characterExists'),
					flags: MessageFlags.Ephemeral,
				});
				return;
			}
			if (error.code === 'INVALID_CHARACTER_NAME') {
				await interaction.reply({
					content: t(locale, 'errors.invalidCharacterKey'),
					flags: MessageFlags.Ephemeral,
				});
				return;
			}
			throw error;
		}
	},
};

const { MessageFlags } = require('discord.js');
const characterStore = require('../../../services/characterStore');
const { getCharacterChoices } = require('../autocomplete');
const { getLocale, localizeDescription, t } = require('../../../util/i18n');

const descriptionKey = 'rpg.delete.description';

module.exports = {
	name: 'delete',
	description: t('en', descriptionKey),
	descriptionKey,
	usage: '/rpg delete character-key:<key>',
	helpOrder: 70,
	configure: command => localizeDescription(command.setName('delete'), descriptionKey)
		.addStringOption(option => localizeDescription(
			option.setName('character-key'),
			'rpg.delete.characterOption',
		)
			.setAutocomplete(true)
			.setRequired(true)),
	async autocomplete({ interaction }) {
		await interaction.respond(await getCharacterChoices(
			interaction.options.getFocused(),
			{ creatorId: interaction.user.id },
		));
	},
	async execute({ config, interaction }) {
		const locale = getLocale(config, interaction.guildId);
		const name = interaction.options.getString('character-key', true);
		try {
			await characterStore.deleteCharacter(name, interaction.user.id);
			await interaction.reply(t(locale, 'rpg.delete.success', { key: name }));
		}
		catch (error) {
			if (error.code === 'ENOENT') {
				await interaction.reply({
					content: t(locale, 'errors.characterMissing'),
					flags: MessageFlags.Ephemeral,
				});
				return;
			}
			if (error.code === 'NOT_CHARACTER_OWNER') {
				await interaction.reply({
					content: t(locale, 'errors.characterOwnerDelete'),
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

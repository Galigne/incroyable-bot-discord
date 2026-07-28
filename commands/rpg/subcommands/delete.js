const {
	deleteCharacter,
} = require('../../../services/characterApplicationService');
const { canManageCharacter, hasDmPermission } = require('../../../util/authorization');
const {
	createCharacterDeletedResponse,
} = require('../../../util/characterCommandResponses');
const { replyToCharacterError } = require('../../../util/characterCommandErrors');
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
	async autocomplete({ config, interaction }) {
		await interaction.respond(await getCharacterChoices(
			interaction.options.getFocused(),
			hasDmPermission(interaction, config)
				? {}
				: { creatorId: interaction.user.id },
		));
	},
	async execute({ config, interaction }) {
		const locale = getLocale(config, interaction.guildId);
		const name = interaction.options.getString('character-key', true);
		try {
			await deleteCharacter(
				name,
				character => canManageCharacter(interaction, character, config),
			);
			await interaction.reply(createCharacterDeletedResponse(name, locale));
		}
		catch (error) {
			if (!await replyToCharacterError(interaction, error, locale)) {
				throw error;
			}
		}
	},
};

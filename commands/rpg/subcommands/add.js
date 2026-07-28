const {
	createCharacter,
} = require('../../../services/characterApplicationService');
const {
	createCharacterAddedResponse,
} = require('../../../util/characterCommandResponses');
const { replyToCharacterError } = require('../../../util/characterCommandErrors');
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
			await createCharacter(characterKey, interaction.user.id);
			await interaction.reply(createCharacterAddedResponse(characterKey, locale));
		}
		catch (error) {
			if (!await replyToCharacterError(interaction, error, locale)) {
				throw error;
			}
		}
	},
};

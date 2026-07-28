const {
	endCharacterTurn,
} = require('../../../services/characterApplicationService');
const { canManageCharacter } = require('../../../util/authorization');
const {
	createEndTurnResponse,
} = require('../../../util/characterCommandResponses');
const { replyToCharacterError } = require('../../../util/characterCommandErrors');
const { getCharacterChoices } = require('../autocomplete');
const { getLocale, localizeDescription, t } = require('../../../util/i18n');

const descriptionKey = 'rpg.endTurn.description';

module.exports = {
	name: 'end-turn',
	description: t('en', descriptionKey),
	descriptionKey,
	usage: '/rpg end-turn character-key:<key>',
	helpOrder: 60,
	configure: command => localizeDescription(command.setName('end-turn'), descriptionKey)
		.addStringOption(option => localizeDescription(
			option.setName('character-key'),
			'rpg.endTurn.characterOption',
		)
			.setAutocomplete(true)
			.setRequired(true)),
	async autocomplete({ interaction }) {
		await interaction.respond(await getCharacterChoices(interaction.options.getFocused()));
	},
	async execute({ config, interaction }) {
		const locale = getLocale(config, interaction.guildId);
		const characterName = interaction.options.getString('character-key', true);
		try {
			const result = await endCharacterTurn(
				characterName,
				currentCharacter => canManageCharacter(interaction, currentCharacter, config),
			);
			await interaction.reply(createEndTurnResponse(result, locale));
		}
		catch (error) {
			if (!await replyToCharacterError(interaction, error, locale)) {
				throw error;
			}
		}
	},
};

const characterStore = require('../../../services/characterStore');
const { resetTurnResources } = require('../../../services/mechanics/resources');
const { canManageCharacter } = require('../../../util/authorization');
const { replyToCharacterError } = require('../../../util/characterCommandErrors');
const { getCharacterChoices } = require('../autocomplete');
const { getLocale, localizeDescription, t } = require('../../../util/i18n');
const { getResourceAbbreviation } = require('../../../util/characterDisplay');

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
			const character = await characterStore.updateCharacter(
				characterName,
				currentCharacter => canManageCharacter(interaction, currentCharacter, config),
				currentCharacter => {
					resetTurnResources(currentCharacter);
				},
			);
			await interaction.reply(t(locale, 'rpg.endTurn.result', {
				ap: character.resources.ap.current,
				apLabel: getResourceAbbreviation(locale, 'ap'),
				md: character.resources.md.current,
				mdLabel: getResourceAbbreviation(locale, 'md'),
				name: character.displayName,
			}));
		}
		catch (error) {
			if (!await replyToCharacterError(interaction, error, locale)) {
				throw error;
			}
		}
	},
};

const characterStore = require('../../../services/characterStore');
const { resetTurnResources } = require('../../../services/characterEditor');
const { canManageCharacters } = require('../../../util/characterAuthorization');
const { replyToCharacterError } = require('../../../util/characterCommandErrors');
const { getCharacterChoices } = require('../autocomplete');

module.exports = {
	name: 'end-turn',
	description: 'Restore current AP and MD to their maximum values',
	usage: '/rpg end-turn character-key:<key>',
	helpOrder: 60,
	configure: command => command
		.setName('end-turn')
		.setDescription('Restore current AP and MD to their maximum values')
		.addStringOption(option => option
			.setName('character-key')
			.setDescription('Character ending their turn')
			.setAutocomplete(true)
			.setRequired(true)),
	async autocomplete({ interaction }) {
		await interaction.respond(await getCharacterChoices(interaction.options.getFocused()));
	},
	async execute({ config, interaction }) {
		const characterName = interaction.options.getString('character-key', true);
		try {
			const character = await characterStore.updateCharacter(
				characterName,
				interaction.user.id,
				canManageCharacters(interaction, config),
				currentCharacter => {
					resetTurnResources(currentCharacter);
				},
			);
			await interaction.reply(
				`**${character.displayName}** starts a new turn with `
				+ `${character.resources.ap.current} AP and ${character.resources.md.current} MD.`,
			);
		}
		catch (error) {
			if (!await replyToCharacterError(interaction, error)) {
				throw error;
			}
		}
	},
};

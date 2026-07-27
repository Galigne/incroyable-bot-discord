const characterStore = require('../../../services/characterStore');
const { resetTurnResources } = require('../../../services/characterEditor');
const { canManageCharacters } = require('../../../util/characterAuthorization');
const { replyToCharacterError } = require('../../../util/characterCommandErrors');

module.exports = {
	name: 'endturn',
	description: 'Restore current AP and MD to their maximum values',
	usage: '!rpg endTurn <character>',
	helpOrder: 60,
	async execute({ args, config, message }) {
		const [characterName] = args;
		if (!characterName) {
			await message.reply('Usage: `!rpg endTurn <character>`');
			return;
		}

		try {
			const character = await characterStore.updateCharacter(
				characterName,
				message.author.id,
				canManageCharacters(message, config),
				currentCharacter => {
					resetTurnResources(currentCharacter);
				},
			);
			await message.reply(
				`**${character.name}** starts a new turn with `
				+ `${character.resources.ap.current} AP and ${character.resources.md.current} MD.`,
			);
		}
		catch (error) {
			if (!await replyToCharacterError(message, error)) {
				throw error;
			}
		}
	},
};

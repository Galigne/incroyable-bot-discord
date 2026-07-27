const characterStore = require('../../../services/characterStore');
const { populateRandomCharacter } = require('../../../services/randomCharacterGenerator');
const { replyToCharacterError } = require('../../../util/characterCommandErrors');

module.exports = {
	name: 'generatecharacter',
	description: 'Generate and save a complete random character (DM only)',
	usage: '!rpg generateCharacter <characterKey> [level]',
	helpOrder: 15,
	access: {
		role: 'dm',
	},
	async execute({ args, message }) {
		const [characterKey, levelValue, ...extraArgs] = args;
		const level = levelValue === undefined ? undefined : Number(levelValue);
		if (
			!characterKey
			|| extraArgs.length > 0
			|| (level !== undefined && (!Number.isInteger(level) || level < 1 || level > 10))
		) {
			await message.reply(
				'Usage: `!rpg generateCharacter <characterKey> [level 1-10]`',
			);
			return;
		}

		try {
			const character = await characterStore.createCharacter(
				characterKey,
				message.author.id,
				generatedCharacter => populateRandomCharacter(generatedCharacter, { level }),
			);
			const embed = character.toEmbed()
				.setFooter({ text: `Character key: ${character.key}` });
			await message.channel.send({
				content: `Generated character **${character.displayName}** with key \`${character.key}\`.`,
				embeds: [embed],
			});
		}
		catch (error) {
			if (!await replyToCharacterError(message, error)) {
				throw error;
			}
		}
	},
};

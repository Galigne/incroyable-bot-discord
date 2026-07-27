const characterStore = require('../../../services/characterStore');
const { restoreResource } = require('../../../services/characterEditor');
const { canManageCharacters } = require('../../../util/characterAuthorization');
const { replyToCharacterError } = require('../../../util/characterCommandErrors');

module.exports = {
	name: 'rest',
	description: 'Restore current HP or AR to a percentage of its maximum',
	usage: '!rpg rest <character> <HP|AR> <percentage>',
	helpOrder: 50,
	async execute({ args, config, message }) {
		const [characterName, resourceName, percentageValue] = args;
		const resource = resourceName?.toLowerCase();
		const percentage = Number(percentageValue?.replace(/%$/, ''));
		if (
			!characterName
			|| !['hp', 'ar'].includes(resource)
			|| !Number.isFinite(percentage)
			|| percentage < 0
			|| percentage > 100
		) {
			await message.reply('Usage: `!rpg rest <character> <HP|AR> <0-100%>`');
			return;
		}

		try {
			const character = await characterStore.updateCharacter(
				characterName,
				message.author.id,
				canManageCharacters(message, config),
				currentCharacter => {
					restoreResource(currentCharacter, resource, percentage);
				},
			);
			const target = character.resources[resource];
			await message.reply(
				`**${character.name}** now has ${target.current}/${target.max} `
				+ `${resource.toUpperCase()} (${percentage}%).`,
			);
		}
		catch (error) {
			if (!await replyToCharacterError(message, error)) {
				throw error;
			}
		}
	},
};

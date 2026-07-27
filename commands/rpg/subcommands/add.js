const { MessageFlags } = require('discord.js');
const characterStore = require('../../../services/characterStore');

module.exports = {
	name: 'add',
	description: 'Create a blank character sheet with a stable CharacterKey',
	usage: '/rpg add character-key:<new key>',
	helpOrder: 20,
	configure: command => command
		.setName('add')
		.setDescription('Create a blank character sheet with a stable CharacterKey')
		.addStringOption(option => option
			.setName('character-key')
			.setDescription('Unique save key, for example D.Robert')
			.setMinLength(1)
			.setMaxLength(50)
			.setRequired(true)),
	async execute({ interaction }) {
		const characterKey = interaction.options.getString('character-key', true);
		try {
			await characterStore.createCharacter(characterKey, interaction.user.id);
			await interaction.reply(
				`Character with key \`${characterKey}\` was created. `
				+ 'This CharacterKey cannot be edited. Use `/rpg edit` with a field '
				+ 'to open its prefilled private form.',
			);
		}
		catch (error) {
			if (error.code === 'EEXIST') {
				await interaction.reply({
					content: 'A character with that key already exists.',
					flags: MessageFlags.Ephemeral,
				});
				return;
			}
			if (error.code === 'INVALID_CHARACTER_NAME') {
				await interaction.reply({
					content: error.message,
					flags: MessageFlags.Ephemeral,
				});
				return;
			}
			throw error;
		}
	},
};

const characterStore = require('../../../services/characterStore');
const { getCharacterChoices } = require('../autocomplete');

module.exports = {
	name: 'delete',
	description: 'Delete one of your characters',
	usage: '/rpg delete character-key:<key>',
	helpOrder: 70,
	configure: command => command
		.setName('delete')
		.setDescription('Delete one of your characters')
		.addStringOption(option => option
			.setName('character-key')
			.setDescription('Character to delete')
			.setAutocomplete(true)
			.setRequired(true)),
	async autocomplete({ interaction }) {
		await interaction.respond(await getCharacterChoices(
			interaction.options.getFocused(),
			{ creatorId: interaction.user.id },
		));
	},
	async execute({ interaction }) {
		const name = interaction.options.getString('character-key', true);
		try {
			await characterStore.deleteCharacter(name, interaction.user.id);
			await interaction.reply(`Character **${name}** was deleted.`);
		}
		catch (error) {
			if (error.code === 'ENOENT') {
				await interaction.reply({
					content: 'That character does not exist.',
					ephemeral: true,
				});
				return;
			}
			if (error.code === 'NOT_CHARACTER_OWNER') {
				await interaction.reply({ content: error.message, ephemeral: true });
				return;
			}
			if (error.code === 'INVALID_CHARACTER_NAME') {
				await interaction.reply({ content: error.message, ephemeral: true });
				return;
			}
			throw error;
		}
	},
};

module.exports = {
	async execute({ interaction }) {
		await interaction.reply(interaction.options.getString('message', true));
	},
};

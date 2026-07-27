const { EmbedBuilder } = require('discord.js');

module.exports = {
	name: 'help',
	description: 'Liste toutes les commandes',
	async execute(message, bot) {
		const commandList = new EmbedBuilder()
			.setTitle('Gon Freecss')
			.setDescription('Voici la liste des commandes :')
			.setColor('#FFD700')
			.setThumbnail(bot.user.displayAvatarURL());

		for (const command of bot.commands.values()) {
			commandList.addFields({
				name: command.name,
				value: command.description,
			});
		}

		await message.channel.send({ embeds: [commandList] });
	},
};

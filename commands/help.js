const fs = require('fs')
const Discord = require('discord.js');

module.exports = {
	name: 'help',
	description: 'Liste toutes les commandes',
	execute(message, bot) {
		const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

		let commandList = new Discord.MessageEmbed()
		.setTitle("Gon Freecss")
		.setDescription('Voici la liste des commandes:')
		.setColor('#FFD700')
		.setThumbnail(bot.user.displayAvatarURL());
		

		for (var file of commandFiles) {
			var command = require(`./${file}`);
			commandList.addField(command.name, command.description);
		}

		message.channel.send(commandList);
	},
};
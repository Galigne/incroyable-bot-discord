const path = require('node:path');
const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { t } = require('./i18n');
const { sortByHelpOrder } = require('./sortByHelpOrder');

function createCommandHelpResponse(commands, avatarUrl, locale = 'en') {
	const embed = new EmbedBuilder()
		.setTitle(t(locale, 'commands.help.title'))
		.setDescription(t(locale, 'commands.help.available'))
		.setColor('#FFD700')
		.setThumbnail(avatarUrl);

	for (const command of sortByHelpOrder(commands)) {
		embed.addFields({
			name: command.usage ?? `/${command.name}`,
			value: command.descriptionKey
				? t(locale, command.descriptionKey)
				: command.description,
		});
	}
	return { embeds: [embed] };
}

function createRpgHelpResponse(subcommands, locale = 'en') {
	const embed = new EmbedBuilder()
		.setTitle(t(locale, 'rpg.help.title'))
		.setDescription(t(locale, 'rpg.help.body'))
		.setColor('#FFD700')
		.setThumbnail('attachment://logo.jpg');

	for (const subcommand of sortByHelpOrder(subcommands)) {
		embed.addFields({
			name: subcommand.usage,
			value: subcommand.descriptionKey
				? t(locale, subcommand.descriptionKey)
				: subcommand.description,
		});
	}
	const logo = new AttachmentBuilder(
		path.join(__dirname, '..', 'media', 'LOGO.jpg'),
		{ name: 'logo.jpg' },
	);
	return {
		embeds: [embed],
		files: [logo],
	};
}

module.exports = {
	createCommandHelpResponse,
	createRpgHelpResponse,
};

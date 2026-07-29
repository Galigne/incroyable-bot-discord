const path = require('node:path');
const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { t } = require('./i18n');

function createCommandHelpResponse(commands, avatarUrl, locale = 'en') {
	const embed = new EmbedBuilder()
		.setTitle(t(locale, 'commands.help.title'))
		.setDescription(t(locale, 'commands.help.available'))
		.setColor('#FFD700')
		.setThumbnail(avatarUrl);

	for (const command of sortMetadata(commands)) {
		embed.addFields({
			name: command.examples[0],
			value: t(
				locale,
				command.help.summaryKey ?? command.descriptionKey,
			),
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

	for (const subcommand of sortMetadata(subcommands)) {
		embed.addFields({
			name: subcommand.examples[0],
			value: t(
				locale,
				subcommand.help.summaryKey ?? subcommand.descriptionKey,
			),
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

function sortMetadata(metadata) {
	return [...metadata].sort((left, right) => left.help.order - right.help.order);
}

module.exports = {
	createCommandHelpResponse,
	createRpgHelpResponse,
};

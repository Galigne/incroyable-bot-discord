const fs = require('node:fs/promises');
const path = require('node:path');
const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const Character = require('../classes/Character.js');

module.exports = {
	name: 'jdr',
	description: 'Commandes pour JDR',
	async execute(message) {
		const args = message.content.trim().split(/\s+/);
		const subcommand = args[1]?.toLowerCase();

		switch (subcommand) {
			case 'add':
				await addCharacter(message, args[2]);
				break;
			case 'delete':
				await deleteCharacter(message, args[2]);
				break;
			case 'rules':
				await sendEmbed(
					message,
					'ruleList.json',
					path.join('media', 'book.jpg'),
					'book.jpg',
				);
				break;
			case 'help':
				await sendEmbed(
					message,
					'commandList.json',
					path.join('media', 'LOGO.jpg'),
					'logo.jpg',
				);
				break;
			default:
				if (subcommand) {
					await showCharacter(message, args[1]);
				}
				else {
					await message.reply('Essayez **!JDR help** pour afficher les commandes.');
				}
		}
	},
};

function savePath(name) {
	if (!name || !/^[\p{L}\p{N}_-]{1,50}$/u.test(name)) {
		throw new Error('Le nom doit contenir uniquement des lettres, chiffres, tirets ou underscores.');
	}
	return path.join(__dirname, '..', 'save', `${name}.json`);
}

async function addCharacter(message, name) {
	try {
		const character = new Character(name, message.author.id);
		await fs.writeFile(savePath(name), JSON.stringify(character, null, 2), {
			encoding: 'utf8',
			flag: 'wx',
		});
		await message.reply('Votre personnage a été créé.');
	}
	catch (error) {
		if (error.code === 'EEXIST') {
			await message.reply('Un personnage porte déjà ce nom.');
			return;
		}
		await message.reply(error.message);
	}
}

async function deleteCharacter(message, name) {
	try {
		const data = await fs.readFile(savePath(name), 'utf8');
		const character = Character.getCharacterFromSave(JSON.parse(data));
		if (character.creatorID !== message.author.id) {
			await message.reply('Vous n’êtes pas le créateur de ce personnage.');
			return;
		}
		await fs.unlink(savePath(name));
		await message.reply('Votre personnage a été supprimé.');
	}
	catch (error) {
		if (error.code === 'ENOENT') {
			await message.reply('Ce personnage n’existe pas.');
			return;
		}
		await message.reply(error.message);
	}
}

async function showCharacter(message, name) {
	try {
		const data = await fs.readFile(savePath(name), 'utf8');
		const character = Character.getCharacterFromSave(JSON.parse(data));
		await message.channel.send({ embeds: [character.toMessageEmbed()] });
	}
	catch (error) {
		if (error.code === 'ENOENT') {
			await message.reply('Ce personnage n’existe pas.');
			return;
		}
		await message.reply(error.message);
	}
}

async function sendEmbed(message, embedFile, attachmentPath, attachmentName) {
	const rawEmbed = require(path.join('..', 'embeds', embedFile));
	const { color, ...embedData } = rawEmbed;
	const embed = new EmbedBuilder(embedData).setColor(color);
	const attachment = new AttachmentBuilder(
		path.join(__dirname, '..', attachmentPath),
		{ name: attachmentName },
	);
	await message.channel.send({
		embeds: [embed],
		files: [attachment],
	});
}

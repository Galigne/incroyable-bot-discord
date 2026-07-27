const path = require('node:path');
const { AttachmentBuilder } = require('discord.js');

module.exports = {
	name: 'roll',
	description: 'Lance un dé et donne le résultat',
	async execute(message) {
		const maxRoll = Number.parseInt(message.content.split(/\s+/)[1], 10);
		if (!maxRoll || maxRoll < 2 || maxRoll > 1000) {
			await message.reply('Donnez la valeur du lancer de dé (entre 2 et 1000).');
			return;
		}

		const rollValue = Math.floor(Math.random() * maxRoll) + 1;
		if (maxRoll === 20) {
			const diceGif = new AttachmentBuilder(
				path.join(__dirname, '..', 'media', `D20-${rollValue}.gif`),
			);
			await message.channel.send({ files: [diceGif] });
			return;
		}

		await message.channel.send(`Vous avez obtenu ${rollValue}.`);
	},
};

const path = require('node:path');
const { AttachmentBuilder } = require('discord.js');

module.exports = {
	name: 'roll',
	description: 'Roll a die with a configurable number of sides',
	usage: '!roll <2-1000>',
	helpOrder: 20,
	async execute({ args, message }) {
		const sides = Number.parseInt(args[0], 10);
		if (!sides || sides < 2 || sides > 1000) {
			await message.reply('Choose a die size between 2 and 1000.');
			return;
		}

		const result = Math.floor(Math.random() * sides) + 1;
		if (sides === 2) {
			const coinSide = result === 1 ? 'HEADS' : 'TAILS';
			const animation = new AttachmentBuilder(
				path.join(__dirname, '..', 'media', `${coinSide}.gif`),
			);
			await message.channel.send({ files: [animation] });
			return;
		}
		if (sides === 20) {
			const animation = new AttachmentBuilder(
				path.join(__dirname, '..', 'media', `D20-${result}.gif`),
			);
			await message.channel.send({ files: [animation] });
			return;
		}

		await message.channel.send(`You rolled **${result}**.`);
	},
};

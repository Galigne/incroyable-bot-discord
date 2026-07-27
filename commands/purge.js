module.exports = {
	name: 'purge',
	description: 'Delete recent messages from the current channel',
	usage: '!purge <2-100>',
	helpOrder: 60,
	access: {
		role: 'owner',
	},
	async execute({ args, message }) {
		const deleteCount = Number.parseInt(args[0], 10);
		if (!deleteCount || deleteCount < 2 || deleteCount > 100) {
			await message.reply('Choose a number of messages between 2 and 100.');
			return;
		}

		const deleted = await message.channel.bulkDelete(deleteCount, true);
		await message.channel
			.send(`Deleted ${deleted.size} recent messages.`)
			.then(response => setTimeout(() => response.delete().catch(() => {}), 3_000));
	},
};

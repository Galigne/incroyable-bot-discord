async function reconnectClient(client, discordToken) {
	client.destroy();
	await client.login(discordToken);
}

module.exports = { reconnectClient };

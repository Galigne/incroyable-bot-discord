async function reconnectClient(client, discordToken, logger = console) {
	logger.log('[reload] discordReconnect: destruction invoked.');
	const destruction = client.destroy();
	if (destruction && typeof destruction.then === 'function') {
		await destruction;
	}
	logger.log('[reload] discordReconnect: destruction completed.');
	logger.log('[reload] discordReconnect: login beginning.');
	await client.login(discordToken);
	logger.log('[reload] discordReconnect: login completed.');
}

module.exports = { reconnectClient };

async function reconnectClient(client, discordToken, logger = console) {
	logger.log('[reload] discordReconnect: destruction invoked.');
	const destruction = client.destroy();
	if (destruction && typeof destruction.then === 'function') {
		destruction.then(
			() => logger.log('[reload] discordReconnect: destruction completed.'),
			error => logger.error(
				'[reload] discordReconnect: destruction failed:',
				error,
			),
		);
	}
	logger.log('[reload] discordReconnect: login beginning.');
	await client.login(discordToken);
	logger.log('[reload] discordReconnect: login completed.');
}

module.exports = { reconnectClient };

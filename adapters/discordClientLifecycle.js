async function reconnectClient(client, token) {
	client.destroy();
	await client.login(token);
}

module.exports = { reconnectClient };

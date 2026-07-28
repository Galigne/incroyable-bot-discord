const {
	Client,
	Collection,
	GatewayIntentBits,
} = require('discord.js');

module.exports = class extends Client {
	constructor() {
		super({
			intents: [
				GatewayIntentBits.Guilds,
				GatewayIntentBits.GuildVoiceStates,
			],
		});

		this.commands = new Collection();
	}
};

const {
  Client,
  Collection,
  GatewayIntentBits
} = require("discord.js");

module.exports = class extends Client {
	constructor() {
		super({
		intents: [
			GatewayIntentBits.Guilds,
			GatewayIntentBits.GuildMessages,
			GatewayIntentBits.MessageContent,
			GatewayIntentBits.GuildInvites,
			GatewayIntentBits.GuildMembers,
			GatewayIntentBits.GuildPresences,
			GatewayIntentBits.GuildMessageReactions,
			GatewayIntentBits.GuildVoiceStates,
		]
		});

		this.commands = new Collection();

		this.queue = new Map();
	}
};
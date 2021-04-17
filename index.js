const fs = require('fs');
const Discord = require('discord.js');
const Client = require('./client/Client');
const {
	prefix,
	token,
	uneIncroyableMerde,
	uneIncroyablePersonne,
	unIncroyableModerateur,
	unIncroyableBot,
	lePlusIncroyable,
	cmd,
	elite,
	elite_voice,
	chat,
	replays,
	musiques,
	moba_voice,
	fps_voice,
	rpg_voice,
	fighting_voice,
	souls_voice,
	br_voice,
	jdr_voice,
	bar_voice,
	equipe,
	equipe_voice
} = require('./config.json');

const client = new Client();
client.commands = new Discord.Collection();

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	client.commands.set(command.name, command);
}

client.once('ready', () => {
	console.log('Ready!');
});

client.once('reconnecting', () => {
	console.log('Reconnecting!');
});

client.once('disconnect', () => {
	console.log('Disconnect!');
});

client.on('message', async message => {
	const args = message.content.slice(prefix.length).split(/ +/);
	const commandName = args.shift().toLowerCase();
	const command = client.commands.get(commandName);

	if (message.author.bot) return;
	if (!message.content.startsWith(prefix)) return;
	if (!message.member.roles.cache.some(role => role.id === lePlusIncroyable || role.id === unIncroyableModerateur || role.id === uneIncroyablePersonne)) return;

	try {
		if(commandName == "purge") {
			if (message.member.roles.cache.some(role => role.id === lePlusIncroyable)){
				command.execute(message);
			} else {
				message.reply('Tu n\'es pas assez incroyable pour utiliser cette commande');
			}
		} else if (commandName == "play" || commandName == "skip" || commandName == "stop"){
			if (message.channel.id === cmd || message.channel.id === musiques){
				command.execute(message);
			} else {
				message.reply('Cette commande doit etre utilisée dans le channel \"des_incroyables_musiques\"');
				message.delete();
			}
		} else if (commandName == "restart") {
			if (message.channel.id === cmd && message.member.roles.cache.some(role => role.id === lePlusIncroyable)){
				command.execute(message, client, token);
			} else {
				message.reply('Vous n\'avait pas accès à cette commande');
				message.delete();
			}
		} else if (commandName == "say") {
			if (message.member.roles.cache.some(role => role.id === lePlusIncroyable || role.id === unIncroyableModerateur)){
				command.execute(message);
			} else {
				message.reply('Vous n\'avait pas accès à cette commande');
				message.delete();
			}
		} else if (commandName == "help") {
			command.execute(message, client);
		} else {
			command.execute(message);
		}
	} catch (error) {
		console.error(error);
		message.reply('Il y a eu une erreur 🙃');
	}
});

client.on('guildMemberAdd', guildMember =>{
	try{
		guildMember.roles.add(uneIncroyableMerde);
	} catch (error) {
		console.error(error);
		message.reply('Il y a eu une erreur 🙃');
	}
});

client.on('voiceStateUpdate', (oldMember, newMember) => {
	let newUserChannel = newMember.channel;

	if(newUserChannel !== null && newUserChannel.id === equipe_voice && oldMember.member.id !== unIncroyableBot) {
		newMember.member.voice.channel.join().then(VoiceConnection => {
			VoiceConnection.play("./music/Poutouyemoun.mp3").on("finish", () => VoiceConnection.disconnect());
		}).catch(e => console.log(e))
	}
})

client.login(token);
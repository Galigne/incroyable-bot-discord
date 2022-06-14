const { MessageAttachment } = require("discord.js");
const fs = require('fs')
const Discord = require('discord.js');
const { info } = require("console");
const Character = require('../classes/Character.js');

module.exports = {
	name: 'jdr',
	description: 'Commandes pour JDR',
	async execute(message) {
        const args = message.content.split(' ');
		var commandName = args[1];
        switch (commandName){
            case undefined:
                message.reply("La commande **!JDR** n'existe pas, essayez **!JDR help**");
                break;
            case "add":
                addCharacter(message, args[2], message.author.id);
                break;
            case "delete":
                delCharacter(message);
                break;
            case "rules":
                rules(message);
                break;
            case "help":
                help(message);
                break;
            default:
                commandName = args[2];
                switch (commandName) {
                    case undefined:
                        infos(message, args[1]);
                        break;
                    case "roll":
                        rollD20(message);
                        break;
                    default:
                        message.reply("Cette commande n'existe pas");
                        break;
                }
                break;
        }
    },   
};

function rollD20(message) {  
    let rollValue = Math.floor(Math.random()*20)+1;
    const diceGif = new MessageAttachment(`media/D20-${rollValue}.gif`);
    message.channel.send({files: [diceGif]});
}

function addCharacter(message, name, creatorID){
    var character = new Character(name, creatorID);
    var json = JSON.stringify(character);
    fs.writeFile(`save/${name}.json`, json, (err) => {
        if (err)
          message.reply("Error while saving your character", err);
        else {
          message.reply("Your character was created");
        }
    });   
}

function delCharacter(message){
    message.channel.send("TODO...");
}

function infos(message, name){
    fs.readFile(`save/${name}.json`, 'utf8', (err, data) => {
        if (err) {
            message.reply("Error while saving your character", err);
          return;
        }
        var character = Character.getCharacterFromSave(JSON.parse(data));
        console.log(character);
        var embed = character.toMessageEmbed();
        message.channel.send(embed);
      });
}

function rules(message){
    const embed = require('../embeds/ruleList.json');
    message.channel.send({ embed, files:[{attachment:'media/book.jpg',name:'book.jpg'}] });
}

function help(message){
    const embed = require('../embeds/commandList.json');
    message.channel.send({ embed, files:[{attachment:'media/logo.jpg',name:'logo.jpg'}] });
}

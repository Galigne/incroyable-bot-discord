const { MessageAttachment } = require("discord.js");
const fs = require('fs')
const Discord = require('discord.js');
const { info } = require("console");

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
                addCharacter(message);
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
                        infos(message);
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
    const diceGif = new MessageAttachment(`images/D20-${rollValue}.gif`);
    message.channel.send({files: [diceGif]});
}

function addCharacter(message){
    message.channel.send("TODO...");
}

function delCharacter(message){
    message.channel.send("TODO...");
}

function infos(message){
    message.channel.send("TODO...");
}

function rules(message){
    var commandList = new Discord.MessageEmbed()
        .setTitle("Livre de règles")
        .setColor('#FFD700');
    commandList.addField("CONSTITUTION", "Nombre de PV • Résistance aux effets de statuts (poison, paralysie…)");
    commandList.addField("FORCE", "Maniement des armes lourdes • Bloquer ou se protéger • Actions FORCE (porter des poids, Lancer d'objets lourds…)");
    commandList.addField("DEXTÉRITÉ", "Maniement des armes légères et à distance • Esquiver • Actions DEXTÉRITÉ (infiltration, Vol à la tire…)");
    commandList.addField("INTELLIGENCE", "Maîtrise des LOIS • Détermine les points de LOI • Actions INTELLIGENCE (culture générale, compréhension, réflexion, calcul…)");
    commandList.addField("VITESSE", "Détermine l’INITIATIVE et les REFLEXES • Actions VITESSE (vitesse de course et de réflexion)");
    commandList.addField("PERCEPTION", "Précision de visée • Instinct, amélioration des 5 sens • Actions PERCEPTION (repérer un ennemi camouflé, détecter un mensonge…)");
    commandList.addField("CHARISME", "Aisance en public, marchandage, contrôle de soi, gestion des émotions, intimidation, commandement…");
    
    commandList.addField("INITIATIVE", "Déterminé par la VITESSE: ordre de passage des tours (en mode combat)");
    commandList.addField("REFLEXE", "(VITESSE + PERCEPTION) / 3 = REFLEXE (arrondit au plus proche) • Capacité à réagir rapidement à un péril inattendu");

    commandList.addField("POINT D'ACTION (PA)", "Détermine les actions réalisable à chaque tour • 4 points par tour • Peut économiser 50% des points restant à la fin du tour pour le suivant");
    commandList.addField("LOI", "Maitrise d'un pouvoir (feu, télékinésie, illusion, contrôle des animaux…) • Chaque point de LOI permet d'ajouter un pouvoir ou d'en améliorer un");
    commandList.addField("POINTS DE VIE (PV)", "CONSTITUTION * 100 • Plus vos points de vie son bas plus vous êtes proche de la mort et des malus s'appliquent sur vos JETS");
    commandList.addField("ARMURE", "Déterminé par vos équipements • Donne un coefficient de réduction de dégat • Ne peut dépasser 65% de réduction");
    commandList.addField("JET", "Généralement effectué avec un dé 20 • Pour réussir un JET il faut faire moins que votre statistique correspondante • 1 est un coup critique et 20 un échec critique");
    message.channel.send(commandList);
}

function help(message){
    var commandList = new Discord.MessageEmbed()
        .setTitle("Jeu De Rôle")
        .setDescription('Voici la liste des commandes !JDR ')
        .setColor('#FFD700')
    commandList.addField("add <Name>", "Ajoute un nouveau personnage");
    commandList.addField("delete <Name>", "Supprime un personnage");
    commandList.addField("<Name>", "Affiche les informations du personnage");
    commandList.addField("<Name> hit <PV>", "Inflige des dégats au personnage");
    commandList.addField("<Name> heal <PV>", "Heal des HP au personnage");
    commandList.addField("<Name> armor set <%Armure>", "Change le coefficient d'armure du personnage");
    commandList.addField("rules", "Affiche le livre de règle");
    commandList.addField("help", "Affiche toutes les commandes JDR");
    message.channel.send(commandList);
}

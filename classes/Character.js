const Discord = require('discord.js');

class Stats {
    constructor (){
        this.constitution = 10;
        this.force = 10;
        this.dexterite = 10;
        this.intelligence = 10;
        this.vitesse = 10;
        this.perception = 10;
        this.charisme = 10;
    }
};

class Battle {
    constructor() {
        this.maxHP = 100;
        this.currentHP = 80;
        this.armor = 10;
    }
}

class Inventory {
    constructor(){
        this.equipment = ["Lance de feu"];
        this.bag = ["Ton daron le chauve"];
    }
}

class Character {
    static getCharacterFromSave(JSON){
        var character = new Character(JSON.name, JSON.creatorID);
        character.stats = JSON.stats;
        character.combat = JSON.combat;
        character.inventory = JSON.inventory;
        return character;
    }

    constructor(name, creatorID){
        this.name = name;
        this.creatorID = creatorID;
        this.stats = new Stats();
        this.battle = new Battle();
        this.inventory = new Inventory();
    }

    toMessageEmbed(){
        var ASCII_HP = `𝐏𝐕 ${this.battle.currentHP} / ${this.battle.maxHP}\n`;
        var nbRedHeart = Math.floor(this.battle.currentHP/10);
        var nbWhiteHeart = Math.floor(this.battle.maxHP/10) - nbRedHeart;
        for(let i=0; i<nbRedHeart; i++) ASCII_HP += "❤️ ";
        for(let i=0; i<nbWhiteHeart; i++) ASCII_HP += "🤍 ";
        
        var ASCII_armor = `𝗔𝗿𝗺𝘂𝗿𝗲 ${this.battle.armor} %\n`;
        var nbRedShield = Math.floor(this.battle.armor/10);
        var nbWhiteShield = 10 - nbRedShield;
        for(let i=0; i<nbRedShield; i++) ASCII_armor += "⬜ ";
        for(let i=0; i<nbWhiteShield; i++) ASCII_armor += "🔳 ";

        var ASCII_stats = "";
        ASCII_stats += `𝗖𝗼𝗻𝘀𝘁𝗶𝘁𝘂𝘁𝗶𝗼𝗻 [${this.stats.constitution}]\n`;
        ASCII_stats += `𝗙𝗼𝗿𝗰𝗲 [${this.stats.force}]\n`;
        ASCII_stats += `𝗗𝗲𝘅𝘁𝗲𝗿𝗶𝘁𝗲 [${this.stats.dexterite}]\n`;
        ASCII_stats += `𝗜𝗻𝘁𝗲𝗹𝗹𝗶𝗴𝗲𝗻𝗰𝗲 [${this.stats.intelligence}]\n`;
        ASCII_stats += `𝗩𝗶𝘁𝗲𝘀𝘀𝗲 [${this.stats.vitesse}]\n`;
        ASCII_stats += `𝗣𝗲𝗿𝗰𝗲𝗽𝘁𝗶𝗼𝗻 [${this.stats.perception}]\n`;
        ASCII_stats += `𝗖𝗵𝗮𝗿𝗶𝘀𝗺𝗲 [${this.stats.charisme}]`;

        var ASCII_equipement = "";
        for(let i=0; i<this.inventory.equipment.length; i++){
            if (i!=0) ASCII_equipement += "\n";
            ASCII_equipement += "► " + this.inventory.equipment[i];
        }

        var ASCII_bag = "";
        for(let i=0; i<this.inventory.bag.length; i++){
            if (i!=0) ASCII_equipement += "\n";
            ASCII_bag += "► " + this.inventory.bag[i];
        }

        var embed = new Discord.MessageEmbed()
		.setTitle(this.name)
		.setDescription(`**STATUS**\n${ASCII_HP}\n${ASCII_armor}\n\n**STATISTIQUES**\n${ASCII_stats}\n\n**EQUIPEMENT**\n${ASCII_equipement}\n\n**INVENTAIRE**\n${ASCII_bag}`)
		.setColor('#FFD700');

        return embed;
    }
};

module.exports = Character;
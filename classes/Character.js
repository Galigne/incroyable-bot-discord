const { EmbedBuilder } = require('discord.js');

class Stats {
	constructor() {
		this.constitution = 10;
		this.force = 10;
		this.dexterite = 10;
		this.intelligence = 10;
		this.vitesse = 10;
		this.perception = 10;
		this.charisme = 10;
	}
}

class Battle {
	constructor() {
		this.maxHP = 100;
		this.currentHP = 80;
		this.armor = 10;
	}
}

class Inventory {
	constructor() {
		this.equipment = ['Lance de feu'];
		this.bag = ['Ton daron le chauve'];
	}
}

class Character {
	static getCharacterFromSave(data) {
		const character = new Character(data.name, data.creatorID);
		character.stats = data.stats;
		character.battle = data.battle ?? data.combat ?? new Battle();
		character.inventory = data.inventory;
		return character;
	}

	constructor(name, creatorID) {
		this.name = name;
		this.creatorID = creatorID;
		this.stats = new Stats();
		this.battle = new Battle();
		this.inventory = new Inventory();
	}

	toMessageEmbed() {
		const redHearts = Math.floor(this.battle.currentHP / 10);
		const whiteHearts = Math.max(0, Math.floor(this.battle.maxHP / 10) - redHearts);
		const redShields = Math.floor(this.battle.armor / 10);
		const whiteShields = Math.max(0, 10 - redShields);

		const hp = `PV ${this.battle.currentHP} / ${this.battle.maxHP}\n`
			+ `${'❤️ '.repeat(redHearts)}${'🤍 '.repeat(whiteHearts)}`;
		const armor = `Armure ${this.battle.armor} %\n`
			+ `${'⬜ '.repeat(redShields)}${'🔳 '.repeat(whiteShields)}`;
		const stats = [
			`Constitution [${this.stats.constitution}]`,
			`Force [${this.stats.force}]`,
			`Dextérité [${this.stats.dexterite}]`,
			`Intelligence [${this.stats.intelligence}]`,
			`Vitesse [${this.stats.vitesse}]`,
			`Perception [${this.stats.perception}]`,
			`Charisme [${this.stats.charisme}]`,
		].join('\n');
		const equipment = this.inventory.equipment.map(item => `► ${item}`).join('\n') || 'Vide';
		const bag = this.inventory.bag.map(item => `► ${item}`).join('\n') || 'Vide';

		return new EmbedBuilder()
			.setTitle(this.name)
			.setDescription(
				`**STATUS**\n${hp}\n\n${armor}\n\n`
				+ `**STATISTIQUES**\n${stats}\n\n`
				+ `**ÉQUIPEMENT**\n${equipment}\n\n`
				+ `**INVENTAIRE**\n${bag}`,
			)
			.setColor('#FFD700');
	}
}

module.exports = Character;

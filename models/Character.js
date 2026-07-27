const { EmbedBuilder } = require('discord.js');

class Stats {
	constructor(data = {}) {
		this.constitution = data.constitution ?? 10;
		this.strength = data.strength ?? 10;
		this.dexterity = data.dexterity ?? 10;
		this.intelligence = data.intelligence ?? 10;
		this.speed = data.speed ?? 10;
		this.perception = data.perception ?? 10;
		this.charisma = data.charisma ?? 10;
	}
}

class Battle {
	constructor(data = {}) {
		this.maxHp = data.maxHp ?? 100;
		this.currentHp = data.currentHp ?? 80;
		this.armor = data.armor ?? 10;
	}
}

class Inventory {
	constructor(data = {}) {
		this.equipment = data.equipment ?? ['Fire Lance'];
		this.bag = data.bag ?? [];
	}
}

class Character {
	static fromSave(data) {
		const character = new Character(data.name, data.creatorId);
		character.stats = new Stats(data.stats);
		character.battle = new Battle(data.battle);
		character.inventory = new Inventory(data.inventory);
		return character;
	}

	constructor(name, creatorId) {
		this.name = name;
		this.creatorId = creatorId;
		this.stats = new Stats();
		this.battle = new Battle();
		this.inventory = new Inventory();
	}

	toEmbed() {
		const filledHearts = Math.floor(this.battle.currentHp / 10);
		const emptyHearts = Math.max(
			0,
			Math.floor(this.battle.maxHp / 10) - filledHearts,
		);
		const filledShields = Math.floor(this.battle.armor / 10);
		const emptyShields = Math.max(0, 10 - filledShields);

		const health = `HP ${this.battle.currentHp} / ${this.battle.maxHp}\n`
			+ `${'❤️ '.repeat(filledHearts)}${'🤍 '.repeat(emptyHearts)}`;
		const armor = `Armor ${this.battle.armor}%\n`
			+ `${'⬜ '.repeat(filledShields)}${'🔳 '.repeat(emptyShields)}`;
		const stats = [
			`Constitution [${this.stats.constitution}]`,
			`Strength [${this.stats.strength}]`,
			`Dexterity [${this.stats.dexterity}]`,
			`Intelligence [${this.stats.intelligence}]`,
			`Speed [${this.stats.speed}]`,
			`Perception [${this.stats.perception}]`,
			`Charisma [${this.stats.charisma}]`,
		].join('\n');
		const equipment = formatItems(this.inventory.equipment);
		const bag = formatItems(this.inventory.bag);

		return new EmbedBuilder()
			.setTitle(this.name)
			.setDescription(
				`**STATUS**\n${health}\n\n${armor}\n\n`
				+ `**STATS**\n${stats}\n\n`
				+ `**EQUIPMENT**\n${equipment}\n\n`
				+ `**INVENTORY**\n${bag}`,
			)
			.setColor('#FFD700');
	}
}

function formatItems(items) {
	return items.map(item => `► ${item}`).join('\n') || 'Empty';
}

module.exports = Character;

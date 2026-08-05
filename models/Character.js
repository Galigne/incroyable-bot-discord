const {
	copyRules,
	copyStringList,
	copyTalentList,
} = require('../services/mechanics/characterValidation');
const { createResourcesFromSave } = require('../services/mechanics/resources');
const { createStats } = require('../services/mechanics/statistics');
const {
	CURRENT_CHARACTER_SAVE_SCHEMA_VERSION,
} = require('../services/characterSaveSchema');

class Character {
	static fromSave(data, characterKey = data.key) {
		const character = new Character(characterKey, data.creatorId);
		character.firstName = data.firstName ?? '';
		character.lastName = data.lastName ?? '';
		character.level = data.level ?? 1;
		character.race = {
			name: data.race?.name ?? '',
			physicalDescription: data.race?.physicalDescription ?? '',
			lore: data.race?.lore ?? '',
		};
		character.appearance = data.appearance ?? '';
		character.backstory = data.backstory ?? '';
		character.goals = data.goals ?? '';
		character.personality = {
			traits: copyStringList(data.personality?.traits),
			description: data.personality?.description ?? '',
		};
		character.racialTraits = {
			skillBonus: data.racialTraits?.skillBonus ?? '',
			physicalAbility: data.racialTraits?.physicalAbility ?? '',
		};
		character.stats = createStats(data.stats);
		character.rules = copyRules(data.rules);
		character.talents = copyTalentList(data.talents);
		character.resources = createResourcesFromSave(data);
		character.statusEffects = copyStringList(data.statusEffects);
		character.equipment = copyStringList(data.equipment);
		character.inventory = copyStringList(data.inventory);
		character.encumbrance = {
			current: data.encumbrance?.current ?? 0,
			max: data.encumbrance?.max ?? 0,
		};
		return character;
	}

	constructor(key, creatorId) {
		this.schemaVersion = CURRENT_CHARACTER_SAVE_SCHEMA_VERSION;
		this.key = key;
		this.firstName = '';
		this.lastName = '';
		this.creatorId = creatorId;
		this.level = 1;
		this.race = {
			name: '',
			physicalDescription: '',
			lore: '',
		};
		this.appearance = '';
		this.backstory = '';
		this.goals = '';
		this.personality = {
			traits: [],
			description: '',
		};
		this.racialTraits = {
			skillBonus: '',
			physicalAbility: '',
		};
		this.stats = createStats();
		this.rules = [];
		this.talents = [];
		this.resources = {
			hp: { current: 100, max: 100 },
			ar: { current: 0, max: 0 },
			ap: { current: 4, max: 4 },
			md: { current: 5, max: 5 },
		};
		this.statusEffects = [];
		this.equipment = [];
		this.inventory = [];
		this.encumbrance = {
			current: 0,
			max: 0,
		};
	}

	get displayName() {
		return [this.firstName, this.lastName].filter(Boolean).join(' ') || this.key;
	}
}

module.exports = Character;

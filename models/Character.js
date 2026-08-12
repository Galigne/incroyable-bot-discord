const {
	copyRules,
	copyStringList,
	copyTalentList,
} = require('../services/mechanics/characterValidation');
const { createResourcesFromSave } = require('../services/mechanics/resources');
const { createStats } = require('../services/mechanics/statistics');
const {
	CURRENT_CHARACTER_SAVE_SCHEMA_VERSION,
	validateCharacterSaveSchema,
} = require('../services/characterSaveSchema');

class Character {
	static fromSave(data, characterKey = data.key) {
		validateCharacterSaveSchema(data);
		const character = new Character(characterKey, data.creatorId);
		character.name = {
			firstName: data.name?.firstName ?? '',
			lastName: data.name?.lastName ?? '',
		};
		character.level = data.level ?? 1;
		character.race = {
			name: data.race?.name ?? '',
			physicalDescription: data.race?.physicalDescription ?? '',
			lore: data.race?.lore ?? '',
			traits: {
				skillBonus: data.race?.traits?.skillBonus ?? '',
				physicalAbility: data.race?.traits?.physicalAbility ?? '',
			},
		};
		character.background = {
			archetype: data.background?.archetype ?? '',
			physicalDescription: data.background?.physicalDescription ?? '',
			backstory: data.background?.backstory ?? '',
			goals: data.background?.goals ?? '',
		};
		character.personality = {
			traits: copyStringList(data.personality?.traits),
			description: data.personality?.description ?? '',
		};
		character.statistics = createStats(data.statistics);
		character.resources = createResourcesFromSave(data.resources);
		character.status = {
			effects: structuredClone(data.status?.effects ?? []),
			modifiers: structuredClone(data.status?.modifiers ?? []),
		};
		character.rules = copyRules(data.rules);
		character.talents = copyTalentList(data.talents);
		character.gear = {
			equipment: copyStringList(data.gear?.equipment),
			inventory: copyStringList(data.gear?.inventory),
			encumbrance: {
				current: data.gear?.encumbrance?.current ?? 0,
				max: data.gear?.encumbrance?.max ?? 0,
			},
		};
		return character;
	}

	constructor(key, creatorId) {
		this.schemaVersion = CURRENT_CHARACTER_SAVE_SCHEMA_VERSION;
		this.key = key;
		this.creatorId = creatorId;
		this.name = {
			firstName: '',
			lastName: '',
		};
		this.level = 1;
		this.race = {
			name: '',
			physicalDescription: '',
			lore: '',
			traits: {
				skillBonus: '',
				physicalAbility: '',
			},
		};
		this.background = {
			archetype: '',
			physicalDescription: '',
			backstory: '',
			goals: '',
		};
		this.personality = {
			traits: [],
			description: '',
		};
		this.statistics = createStats();
		this.resources = {
			hp: { current: 100, max: 100 },
			ar: { current: 0, max: 0 },
			ap: { current: 4, max: 4 },
			md: { current: 5, max: 5 },
		};
		this.status = {
			effects: [],
			modifiers: [],
		};
		this.rules = [];
		this.talents = [];
		this.gear = {
			equipment: [],
			inventory: [],
			encumbrance: {
				current: 0,
				max: 0,
			},
		};
	}

	get displayName() {
		return [this.name.firstName, this.name.lastName].filter(Boolean).join(' ') || this.key;
	}

	get type() {
		return 'character';
	}
}

module.exports = Character;

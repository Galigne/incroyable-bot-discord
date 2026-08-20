const {
	CURRENT_CHARACTER_SAVE_SCHEMA_VERSION,
	validateCharacterSaveSchema,
} = require('../services/characterSaveSchema');
const { createStats } = require('../services/mechanics/statistics');

class Character {
	static fromSave(data, characterKey = data?.key) {
		validateCharacterSaveSchema(data, characterKey);
		const character = new Character(characterKey, data.creatorId);
		character.name = structuredClone(data.name);
		character.level = data.level;
		character.race = structuredClone(data.race);
		character.background = structuredClone(data.background);
		character.personality = structuredClone(data.personality);
		character.statistics = structuredClone(data.statistics);
		character.resources = structuredClone(data.resources);
		character.status = structuredClone(data.status);
		character.rules = structuredClone(data.rules);
		character.talents = structuredClone(data.talents);
		character.gear = structuredClone(data.gear);
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

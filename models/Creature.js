const { validateCreatureSaveSchema } = require('../services/creatureSaveSchema');
const { normalizeInitialEntitySettings } = require('../services/entitySettings');
const { createStats } = require('../services/mechanics/statistics');

class Creature {
	static fromSave(data, entityKey = data?.key) {
		validateCreatureSaveSchema(data, entityKey);
		const creature = new Creature(entityKey, data.settings);
		creature.level = data.level;
		creature.name = data.name;
		creature.description = data.description;
		creature.source = data.source === null
			? null
			: structuredClone(data.source);
		creature.statistics = structuredClone(data.statistics);
		creature.resources = structuredClone(data.resources);
		creature.status = structuredClone(data.status);
		creature.traits = structuredClone(data.traits);
		creature.rules = structuredClone(data.rules);
		creature.gear = structuredClone(data.gear);
		return creature;
	}

	constructor(key, settings) {
		Object.defineProperty(this, 'type', {
			enumerable: true,
			value: 'creature',
			writable: false,
		});
		Object.defineProperty(this, 'key', {
			enumerable: true,
			value: key,
			writable: true,
		});
		this.settings = structuredClone(normalizeInitialEntitySettings(settings));
		this.level = 1;
		this.name = '';
		this.description = '';
		this.source = null;
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
		this.traits = [];
		this.rules = [];
		this.gear = {
			equipment: [],
			inventory: [],
			encumbrance: { current: 0, max: 0 },
		};
	}

	get displayName() {
		return this.name || this.key;
	}
}

module.exports = Creature;

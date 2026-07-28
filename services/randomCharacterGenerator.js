const generatorCatalog = require('./generatorCatalog');
const {
	allocateRuleLevels,
	calculateRulePoints,
	calculateStatBudget,
	calculateStatCost,
	calculateTalentCount,
	generateStats,
} = require('./mechanics/characterGeneration');
const { canEquipArmor } = require('./mechanics/armor');
const {
	calculateMaxAp,
	createGeneratedResources,
} = require('./mechanics/resources');

function populateRandomCharacter(character, options = {}) {
	const random = options.random ?? Math.random;
	const level = options.level ?? randomInteger(1, 10, random);
	if (!Number.isInteger(level) || level < 1 || level > 10) {
		throw generationError('Character level must be a whole number between 1 and 10.');
	}

	character.level = level;
	const generatedName = pickOne('name', random);
	character.firstName = getField(generatedName, 'FirstName');
	character.lastName = getField(generatedName, 'LastName');

	const race = pickOne('race', random);
	character.race.name = getField(race, 'Name');
	character.race.physicalDescription = getField(race, 'Description');
	character.racialTraits.skillBonus = getField(race, 'Skill Bonus');
	character.racialTraits.physicalAbility = getField(race, 'Physical Ability');

	const background = resolveBackground(options.background, random);
	const backgroundDetails = pickOne(getField(background, 'Generator'), random);
	character.appearance = getField(backgroundDetails, 'Appearance');
	character.backstory = getField(backgroundDetails, 'Backstory');
	character.goals = getField(backgroundDetails, 'Goals');

	character.personality.traits = pickMany('personality', 2, random)
		.map(getTextValue);
	character.stats = generateStats(level, random);

	const rulePointCount = calculateRulePoints(character.stats.intelligence);
	const ruleLevels = allocateRuleLevels(rulePointCount);
	character.rules = pickMany('rules', ruleLevels.length, random)
		.map((entry, index) => ({
			name: getField(entry, 'Name'),
			description: getField(entry, 'Description'),
			level: ruleLevels[index],
		}));

	const talentCount = calculateTalentCount(level);
	character.talents = pickMany('talents', talentCount, random)
		.map(entry => `${getField(entry, 'Name')} — ${getField(entry, 'Description')}`)
		.join('\n');

	character.statusEffects = random() < 0.25
		? [getTextValue(pickOne('statusEffect', random))]
		: [];

	const armor = pickOne(
		'armors',
		random,
		entry => canEquipArmor(
			character.stats.constitution,
			getField(entry, 'Constitution requirement'),
		),
	);
	const weaponCount = randomInteger(1, 2, random);
	const weapons = pickMany('weapons', weaponCount, random);
	const inventoryItems = pickMany('inventory', 3, random);
	const armorPercentage = Number(getField(armor, 'AR percentage'));

	character.resources = createGeneratedResources(
		character.stats,
		level,
		armorPercentage,
	);
	character.equipment = [
		formatNamedEntry(armor),
		...weapons.map(formatNamedEntry),
	];

	const gold = level * randomInteger(1, 20, random) + 5;
	character.inventory = [
		...inventoryItems.map(formatNamedEntry),
		`${gold} gold`,
	];
	character.encumbrance = {
		current: [armor, ...weapons, ...inventoryItems]
			.reduce((total, entry) => total + Number(getField(entry, 'Encumbrance')), 0),
		max: character.stats.constitution,
	};

	return character;
}

function resolveBackground(requestedBackground, random) {
	if (!requestedBackground) {
		return pickOne('background', random);
	}
	const backgroundCategory = generatorCatalog.getCategory('background');
	const normalizedRequest = generatorCatalog.normalizeCategoryName(requestedBackground);
	const background = backgroundCategory?.entries.find(entry => (
		generatorCatalog.normalizeCategoryName(getField(entry, 'Name')) === normalizedRequest
	));
	if (!background) {
		throw generationError(`Unknown background category: ${requestedBackground}.`);
	}
	return background;
}

function pickOne(categoryName, random, predicate = () => true) {
	return pickMany(categoryName, 1, random, predicate)[0];
}

function pickMany(categoryName, count, random, predicate = () => true) {
	const category = generatorCatalog.getCategory(categoryName);
	if (!category) {
		throw generationError(`Missing generator category: ${categoryName}.`);
	}
	const availableEntries = category.entries.filter(predicate);
	if (availableEntries.length < count) {
		throw generationError(
			`Generator category ${categoryName} needs at least ${count} eligible entries.`,
		);
	}

	const selectedEntries = [];
	for (let index = 0; index < count; index += 1) {
		const entry = generatorCatalog.selectWeightedEntry(availableEntries, random);
		selectedEntries.push(entry);
		availableEntries.splice(availableEntries.indexOf(entry), 1);
	}
	return selectedEntries;
}

function getField(entry, requestedField) {
	if (!entry?.fields) {
		throw generationError(`Expected a structured generator entry with ${requestedField}.`);
	}
	const matchingField = Object.keys(entry.fields)
		.find(field => field.toLowerCase() === requestedField.toLowerCase());
	if (!matchingField) {
		throw generationError(`Generator entry is missing field: ${requestedField}.`);
	}
	return entry.fields[matchingField];
}

function getTextValue(entry) {
	if (typeof entry === 'string') {
		return entry;
	}
	if (entry?.value !== undefined) {
		return entry.value;
	}
	throw generationError('Expected a text generator entry.');
}

function formatNamedEntry(entry) {
	const name = getField(entry, 'Name');
	const description = getField(entry, 'Description');
	return `${name} — ${description}`;
}

function randomInteger(min, max, random) {
	return min + randomIndex(max - min + 1, random);
}

function randomIndex(length, random) {
	const randomValue = Math.max(0, Math.min(0.9999999999999999, random()));
	return Math.floor(randomValue * length);
}

function generationError(message) {
	const error = new Error(message);
	error.code = 'INVALID_RANDOM_CHARACTER';
	return error;
}

module.exports = {
	allocateRuleLevels,
	calculateMaxAp,
	calculateRulePoints,
	calculateStatBudget,
	calculateStatCost,
	generateStats,
	populateRandomCharacter,
};

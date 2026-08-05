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
	const locale = options.locale ?? 'en';
	const formatGold = options.formatGold ?? (gold => `${gold} gold`);
	const level = options.level ?? randomInteger(1, 10, random);
	if (!Number.isInteger(level) || level < 1 || level > 10) {
		throw generationError(
			'Character level must be a whole number between 1 and 10.',
			'errors.characterLevelInvalid',
		);
	}

	character.level = level;
	const generatedName = pickOne('name', locale, random);
	character.name.firstName = getField(generatedName, 'FirstName');
	character.name.lastName = getField(generatedName, 'LastName');

	const race = pickOne('race', locale, random);
	character.race.name = getField(race, 'Name');
	character.race.physicalDescription = getField(race, 'Description');
	character.race.traits.skillBonus = getField(race, 'Skill Bonus');
	character.race.traits.physicalAbility = getField(race, 'Physical Ability');

	const background = resolveBackground(options.background, locale, random);
	const backgroundDetails = pickOne(getField(background, 'Generator'), locale, random);
	character.background.appearance = getField(backgroundDetails, 'Appearance');
	character.background.backstory = getField(backgroundDetails, 'Backstory');
	character.background.goals = getField(backgroundDetails, 'Goals');

	character.personality.traits = pickMany('personality', 2, locale, random)
		.map(getTextValue);
	character.statistics = generateStats(level, random);

	const rulePointCount = calculateRulePoints(character.statistics.intelligence);
	const ruleLevels = allocateRuleLevels(rulePointCount);
	character.rules = pickMany('rules', ruleLevels.length, locale, random)
		.map((entry, index) => ({
			name: getField(entry, 'Name'),
			description: getField(entry, 'Description'),
			level: ruleLevels[index],
		}));

	const talentCount = calculateTalentCount(level);
	character.talents = pickMany('talents', talentCount, locale, random)
		.map(entry => `${getField(entry, 'Name')} — ${getField(entry, 'Description')}`);

	character.status.effects = random() < 0.25
		? [getTextValue(pickOne('statusEffect', locale, random))]
		: [];

	const armor = pickOne(
		'armors',
		locale,
		random,
		entry => canEquipArmor(
			character.statistics.constitution,
			getField(entry, 'Constitution requirement'),
		),
	);
	const weaponCount = randomInteger(1, 2, random);
	const weapons = pickMany('weapons', weaponCount, locale, random);
	const inventoryItems = pickMany('inventory', 3, locale, random);
	const armorPercentage = Number(getField(armor, 'AR percentage'));

	Object.assign(character.status, createGeneratedResources(
		character.statistics,
		level,
		armorPercentage,
	));
	character.gear.equipment = [
		formatNamedEntry(armor),
		...weapons.map(formatNamedEntry),
	];

	const gold = level * randomInteger(1, 20, random) + 5;
	character.gear.inventory = [
		...inventoryItems.map(formatNamedEntry),
		formatGold(gold),
	];

	return character;
}

function resolveBackground(requestedBackground, locale, random) {
	if (!requestedBackground) {
		return pickOne('background', locale, random);
	}
	const englishCategory = generatorCatalog.getGenerator('background', 'en');
	const localizedCategory = generatorCatalog.getGenerator('background', locale);
	const normalizedRequest = generatorCatalog.normalizeCategoryName(requestedBackground);
	const backgroundIndex = englishCategory?.entries.findIndex(entry => (
		generatorCatalog.normalizeCategoryName(getField(entry, 'Name')) === normalizedRequest
	));
	const background = backgroundIndex >= 0
		? localizedCategory?.entries[backgroundIndex]
		: undefined;
	if (!background) {
		throw generationError(
			`Unknown background category: ${requestedBackground}.`,
			'errors.backgroundUnknown',
			{ background: requestedBackground },
		);
	}
	return background;
}

function pickOne(categoryName, locale, random, predicate = () => true) {
	return pickMany(categoryName, 1, locale, random, predicate)[0];
}

function pickMany(categoryName, count, locale, random, predicate = () => true) {
	const category = generatorCatalog.getGenerator(categoryName, locale);
	if (!category) {
		throw generationError(
			`Missing generator category: ${categoryName}.`,
			'errors.generatorMissing',
			{ category: categoryName },
		);
	}
	const availableEntries = category.entries.filter(predicate);
	if (availableEntries.length < count) {
		throw generationError(
			`Generator category ${categoryName} needs at least ${count} eligible entries.`,
			'errors.generatorNeedsEntries',
			{ category: categoryName, count },
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
		throw generationError(
			`Expected a structured generator entry with ${requestedField}.`,
			'errors.generatorStructuredExpected',
			{ field: requestedField },
		);
	}
	const matchingField = Object.keys(entry.fields)
		.find(field => field.toLowerCase() === requestedField.toLowerCase());
	if (!matchingField) {
		throw generationError(
			`Generator entry is missing field: ${requestedField}.`,
			'errors.generatorFieldMissing',
			{ field: requestedField },
		);
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
	throw generationError(
		'Expected a text generator entry.',
		'errors.generatorTextExpected',
	);
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

function generationError(message, translationKey, translationVariables = {}) {
	const error = new Error(message);
	error.code = 'INVALID_RANDOM_CHARACTER';
	error.translationKey = translationKey;
	error.translationVariables = translationVariables;
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

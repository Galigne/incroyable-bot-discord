const generatorCatalog = require('./generatorCatalog');
const generatorResolver = require('./generatorResolver');
const {
	maybeGenerateDescriptiveModifiers,
} = require('./descriptiveModifierGenerator');
const { getStatProfile } = require('./statProfileCatalog');
const { selectWeightedEntry } = require('./weightedSelector');
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

const MAIN_EQUIPMENT_WEAPON_CHANCE = 0.8;
const CARRIED_LOOT_COUNT = 3;
const LOOT_DUPLICATE_MAX_ATTEMPTS = 10;

function populateRandomCharacter(character, options = {}) {
	const random = options.random ?? Math.random;
	const locale = options.locale ?? 'en';
	const formatGold = options.formatGold ?? (gold => `${gold} gold`);
	const resolver = options.resolver ?? generatorResolver;
	generatorResolver.assertGeneratorResolverInterface(resolver);
	const level = options.level ?? randomInteger(1, 10, random);
	if (!Number.isInteger(level) || level < 1 || level > 10) {
		throw generationError(
			'Character level must be a whole number between 1 and 10.',
			'errors.characterLevelInvalid',
		);
	}

	character.level = level;
	const generatedName = pickOne('name', locale, random);
	character.name.firstName = getField(generatedName, 'first_name');
	character.name.lastName = getField(generatedName, 'last_name');

	const race = pickOne('race', locale, random);
	character.race.name = getField(race, 'name');
	character.race.physicalDescription = getField(race, 'description');
	character.race.traits.skillBonus = getField(race, 'skill_bonus');
	character.race.traits.physicalAbility = getField(race, 'physical_ability');

	const background = resolveBackground(options.background, locale, random);
	const archetypeResult = resolver.generate(
		`background:${background.id}.generator`,
		locale,
		{ random },
	);
	if (!archetypeResult) {
		throw generationError(
			`Background route ${background.id} is unavailable.`,
			'errors.generatorMissing',
			{ category: background.id },
		);
	}
	const physicalDescriptionResult = resolver.resolveInlineReference(
		'{{ physical_description.description }}',
		locale,
		{ path: 'root.character.background.physicalDescription', random },
	);
	const backgroundModifiers = maybeGenerateDescriptiveModifiers({
		generator: 'modifier_character',
		resolver,
		locale,
		random,
		path: 'root.character.modifier',
	});
	character.background.archetype = getResolvedTextValue(archetypeResult);
	character.background.physicalDescription = getResolvedTextValue(
		physicalDescriptionResult,
	);
	character.background.backstory = '';
	character.background.goals = '';

	character.personality.traits = pickMany('personality', 2, locale, random)
		.map(entry => getField(entry, 'description'));
	const profile = getStatProfile('character-balanced');
	if (!profile) {
		throw generationError(
			'Missing statistical profile: character-balanced.',
			'errors.generatorMissing',
			{ category: 'character-balanced' },
		);
	}
	character.statistics = generateStats({ level, profile, random });

	const rulePointCount = calculateRulePoints(character.statistics.intelligence);
	const ruleLevels = allocateRuleLevels(rulePointCount);
	character.rules = pickMany('rules', ruleLevels.length, locale, random)
		.map((entry, index) => ({
			name: getField(entry, 'name'),
			description: getField(entry, 'description'),
			level: ruleLevels[index],
		}));

	const talentCount = calculateTalentCount(level);
	character.talents = pickMany('talents', talentCount, locale, random)
		.map(entry => `${getField(entry, 'name')} — ${getField(entry, 'description')}`);

	character.status.effects = random() < 0.25
		? [createDescribedRecord(pickOne('status_effect', locale, random))]
		: [];

	const armor = pickOne(
		'armors',
		locale,
		random,
		entry => canEquipArmor(
			character.statistics.constitution,
			getField(entry, 'constitution_requirement'),
		),
	);
	const mainEquipmentCount = randomInteger(1, 2, random);
	const mainEquipment = pickMainEquipment(
		mainEquipmentCount,
		locale,
		random,
	);
	const inventoryItems = pickCarriedLoot(
		CARRIED_LOOT_COUNT,
		locale,
		random,
		resolver,
	);
	const armorPercentage = calculateGeneratedArmorPercentage(
		armor,
		mainEquipment,
	);

	Object.assign(character.resources, createGeneratedResources(
		character.statistics,
		level,
		armorPercentage,
	));
	character.gear.equipment = [
		formatNamedEntry(armor),
		...mainEquipment.map(item => formatNamedEntry(item.entry)),
	];

	const gold = level * randomInteger(1, 20, random) + 5;
	character.gear.inventory = [
		...inventoryItems,
		formatGold(gold),
	];
	character.status.modifiers = backgroundModifiers.map(modifier => structuredClone(modifier));

	return character;
}

function pickMainEquipment(count, locale, random) {
	const generatorIds = Array.from(
		{ length: count },
		() => selectMainEquipmentGenerator(random),
	);
	const entriesByGenerator = new Map();
	for (const generatorId of new Set(generatorIds)) {
		const generatorCount = generatorIds.filter(id => id === generatorId).length;
		entriesByGenerator.set(
			generatorId,
			pickMany(generatorId, generatorCount, locale, random),
		);
	}
	return generatorIds.map(generatorId => ({
		generatorId,
		entry: entriesByGenerator.get(generatorId).shift(),
	}));
}

function selectMainEquipmentGenerator(random) {
	return readRandom(random) < MAIN_EQUIPMENT_WEAPON_CHANCE
		? 'weapons'
		: 'shields';
}

function calculateGeneratedArmorPercentage(armor, mainEquipment) {
	return Number(getField(armor, 'ar_percentage'))
		+ mainEquipment.reduce((total, item) => (
			item.generatorId === 'shields'
				? total + Number(getField(item.entry, 'ar_percentage'))
				: total
		), 0);
}

function pickCarriedLoot(count, locale, random, resolver) {
	const selectedIdentities = new Set();
	const selectedValues = [];
	for (let index = 0; index < count; index += 1) {
		let selected;
		for (let attempt = 0; attempt < LOOT_DUPLICATE_MAX_ATTEMPTS; attempt += 1) {
			const resolved = resolver.generate(
				'loot.generator',
				locale,
				{ random },
			);
			selected = {
				identity: getLootSelectionIdentity(resolved?.provenance),
				value: getResolvedDisplayValue(resolved),
			};
			if (!selectedIdentities.has(selected.identity)) {
				break;
			}
		}
		selectedIdentities.add(selected.identity);
		selectedValues.push(selected.value);
	}
	return selectedValues;
}

function getLootSelectionIdentity(provenance) {
	const selections = (provenance ?? []).filter(record => (
		record.type === 'entry' && record.generatorId && record.entryId
	));
	const routerIndex = selections.findIndex(record => record.generatorId === 'loot');
	const selection = selections[routerIndex + 1];
	if (!selection) {
		throw generationError(
			'Loot resolution omitted child selection provenance.',
			'errors.generatorMissing',
			{ category: 'loot' },
		);
	}
	return `${selection.generatorId}:${selection.entryId}`;
}

function getResolvedDisplayValue(result) {
	const value = result?.outputType === 'fields'
		? Object.values(result.displayFields ?? {}).join(' \u2014 ')
		: result?.value;
	if (typeof value !== 'string' || !value.trim()) {
		throw generationError(
			'Loot resolution did not produce display text.',
			'errors.generatorTextExpected',
		);
	}
	return value;
}

function resolveBackground(requestedBackground, locale, random) {
	if (!requestedBackground) {
		return pickOne('background', locale, random);
	}
	const localizedCategory = generatorCatalog.getGenerator('background', locale);
	const background = localizedCategory?.entries.find(entry => (
		entry.id === requestedBackground
	));
	if (!background) {
		throw generationError(
			`Unknown background category: ${requestedBackground}.`,
			'errors.backgroundUnknown',
			{ background: requestedBackground },
		);
	}
	return background;
}

function pickOne(generatorId, locale, random, predicate = () => true) {
	return pickMany(generatorId, 1, locale, random, predicate)[0];
}

function pickMany(generatorId, count, locale, random, predicate = () => true) {
	const generator = generatorCatalog.getGenerator(generatorId, locale);
	if (!generator) {
		throw generationError(
			`Missing generator category: ${generatorId}.`,
			'errors.generatorMissing',
			{ category: generatorId },
		);
	}
	const availableEntries = generator.entries.filter(predicate);
	if (availableEntries.length < count) {
		throw generationError(
			`Generator category ${generatorId} needs at least ${count} eligible entries.`,
			'errors.generatorNeedsEntries',
			{ category: generatorId, count },
		);
	}

	const selectedEntries = [];
	for (let index = 0; index < count; index += 1) {
		const entry = selectWeightedEntry(availableEntries, random);
		selectedEntries.push(entry);
		availableEntries.splice(availableEntries.indexOf(entry), 1);
	}
	return selectedEntries;
}

function getField(entry, requestedField) {
	if (requestedField === 'name' && typeof entry?.name === 'string') {
		return entry.name;
	}
	if (!entry?.fields) {
		throw generationError(
			`Expected a generator entry with additional field ${requestedField}.`,
			'errors.generatorStructuredExpected',
			{ field: requestedField },
		);
	}
	if (!Object.hasOwn(entry.fields, requestedField)) {
		throw generationError(
			`Generator entry is missing field: ${requestedField}.`,
			'errors.generatorFieldMissing',
			{ field: requestedField },
		);
	}
	return entry.fields[requestedField];
}

function getResolvedTextValue(result) {
	if (typeof result?.value !== 'string') {
		throw generationError(
			'Expected a generator result containing one selected string.',
			'errors.generatorTextExpected',
		);
	}
	return result.value;
}

function formatNamedEntry(entry) {
	const name = getField(entry, 'name');
	const description = getField(entry, 'description');
	return `${name} — ${description}`;
}

function createDescribedRecord(entry) {
	return {
		name: getField(entry, 'name'),
		description: getField(entry, 'description'),
	};
}

function randomInteger(min, max, random) {
	return min + randomIndex(max - min + 1, random);
}

function randomIndex(length, random) {
	const randomValue = readRandom(random);
	return Math.floor(randomValue * length);
}

function readRandom(random) {
	return Math.max(0, Math.min(0.9999999999999999, random()));
}

function generationError(message, translationKey, translationVariables = {}) {
	const error = new Error(message);
	error.code = 'INVALID_RANDOM_CHARACTER';
	error.translationKey = translationKey;
	error.translationVariables = translationVariables;
	return error;
}

module.exports = {
	CARRIED_LOOT_COUNT,
	LOOT_DUPLICATE_MAX_ATTEMPTS,
	MAIN_EQUIPMENT_WEAPON_CHANCE,
	allocateRuleLevels,
	calculateGeneratedArmorPercentage,
	calculateMaxAp,
	calculateRulePoints,
	calculateStatBudget,
	calculateStatCost,
	generateStats,
	pickCarriedLoot,
	pickMainEquipment,
	populateRandomCharacter,
	selectMainEquipmentGenerator,
};

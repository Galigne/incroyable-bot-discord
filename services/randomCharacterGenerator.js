const generatorCatalog = require('./generatorCatalog');
const generatorResolver = require('./generatorResolver');
const {
	maybeGenerateDescriptiveModifiers,
} = require('./descriptiveModifierGenerator');
const {
	getGenerationMetadata,
	getGenerationStatProfileId,
	hasGenerationOverride,
} = require('./generationMetadata');
const {
	resolveArmorReference,
	resolveDescribedReferences,
	resolveFixedRules,
	resolveGearReferences,
	resolveGenerationTemplates,
} = require('./generationReferenceResolver');
const { getStatProfile } = require('./statProfileCatalog');
const { selectWeightedEntry } = require('./weightedSelector');
const {
	randomInteger,
	readNormalizedRandom,
} = require('./random');
const {
	allocateRuleLevels,
	calculateRulePoints,
	calculateTalentCount,
} = require('./mechanics/characterGeneration');
const { generateStats } = require('./mechanics/statGeneration');
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
	const getGenerator = options.getGenerator ?? generatorCatalog.getGenerator;
	const getProfile = options.getStatProfile ?? getStatProfile;
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
	const archetype = getArchetypeEntry(archetypeResult, locale, getGenerator);
	const generation = getGenerationMetadata(archetype);
	const physicalDescriptionResult = resolver.resolveInlineReference(
		'{{ physical_description.description }}',
		locale,
		{ path: 'root.character.background.physicalDescription', random },
	);
	const backgroundModifiers = hasGenerationOverride(generation, 'modifiers')
		? resolveDescribedReferences(generation.modifiers, {
			createError: generationError,
			locale,
			path: 'root.generation.modifiers',
			random,
			resolver,
		})
		: maybeGenerateDescriptiveModifiers({
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
	const statProfileId = getGenerationStatProfileId(generation);
	const profile = getProfile(statProfileId);
	if (!profile) {
		throw generationError(
			`Missing statistical profile: ${statProfileId}.`,
			'errors.generatorMissing',
			{ category: statProfileId },
		);
	}
	character.statistics = generateStats({ level, profile, random });

	if (hasGenerationOverride(generation, 'fixedRules')) {
		character.rules = resolveFixedRules(generation.fixedRules, {
			createError: generationError,
			locale,
			path: 'root.generation.fixedRules',
			random,
			resolver,
		}).rules;
	}
	else {
		const rulePointCount = calculateRulePoints(character.statistics.intelligence);
		const ruleLevels = allocateRuleLevels(rulePointCount);
		character.rules = pickMany('rules', ruleLevels.length, locale, random)
			.map((entry, index) => ({
				name: getField(entry, 'name'),
				description: getField(entry, 'description'),
				level: ruleLevels[index],
			}));
	}

	if (hasGenerationOverride(generation, 'talents')) {
		character.talents = resolveGenerationTemplates(generation.talents, {
			locale,
			path: 'root.generation.talents',
			random,
			resolver,
		});
	}
	else {
		const talentCount = calculateTalentCount(level);
		character.talents = pickMany('talents', talentCount, locale, random)
			.map(entry => (
				`${getField(entry, 'name')} — ${getField(entry, 'description')}`
			));
	}

	character.status.effects = hasGenerationOverride(generation, 'statusEffects')
		? resolveDescribedReferences(generation.statusEffects, {
			createError: generationError,
			locale,
			path: 'root.generation.statusEffects',
			random,
			resolver,
		})
		: (
			random() < 0.25
				? [createDescribedRecord(pickOne('status_effect', locale, random))]
				: []
		);

	let armorPercentage = generation.naturalArmorPercentage ?? 0;
	let armorValue;
	if (hasGenerationOverride(generation, 'armor')) {
		const resolvedArmor = resolveArmorReference(generation.armor, {
			createError: generationError,
			locale,
			path: 'root.generation.armor',
			random,
			resolver,
		});
		armorPercentage += resolvedArmor.armorPercentage;
		armorValue = resolvedArmor.value;
	}
	else {
		const armor = pickOne(
			'armors',
			locale,
			random,
			entry => canEquipArmor(
				character.statistics.constitution,
				getField(entry, 'constitution_requirement'),
			),
		);
		armorPercentage += Number(getField(armor, 'ar_percentage'));
		armorValue = formatNamedEntry(armor);
	}

	let equipmentValues;
	if (hasGenerationOverride(generation, 'equipment')) {
		const resolvedEquipment = resolveGearReferences(generation.equipment, {
			createError: generationError,
			locale,
			path: 'root.generation.equipment',
			random,
			resolver,
		});
		armorPercentage += resolvedEquipment.armorPercentage;
		equipmentValues = resolvedEquipment.values;
	}
	else {
		const mainEquipmentCount = randomInteger(1, 2, random);
		const mainEquipment = pickMainEquipment(
			mainEquipmentCount,
			locale,
			random,
		);
		armorPercentage += mainEquipment.reduce((total, item) => (
			item.generatorId === 'shields'
				? total + Number(getField(item.entry, 'ar_percentage'))
				: total
		), 0);
		equipmentValues = mainEquipment.map(item => formatNamedEntry(item.entry));
	}

	let inventoryItems;
	if (hasGenerationOverride(generation, 'inventory')) {
		inventoryItems = resolveGearReferences(generation.inventory, {
			createError: generationError,
			locale,
			path: 'root.generation.inventory',
			random,
			resolver,
		}).values;
	}
	else {
		inventoryItems = pickCarriedLoot(
			CARRIED_LOOT_COUNT,
			locale,
			random,
			resolver,
		);
		const gold = level * randomInteger(1, 20, random) + 5;
		inventoryItems.push(formatGold(gold));
	}

	Object.assign(character.resources, createGeneratedResources(
		character.statistics,
		level,
		armorPercentage,
	));
	character.gear.equipment = [armorValue, ...equipmentValues];
	character.gear.inventory = inventoryItems;
	character.status.modifiers = backgroundModifiers.map(modifier => structuredClone(modifier));

	return character;
}

function getArchetypeEntry(archetypeResult, locale, getGenerator) {
	const archetype = getGenerator(archetypeResult.generatorId, locale)
		?.entries.find(entry => entry.id === archetypeResult.entryId);
	if (!archetype) {
		throw generationError(
			'Selected background archetype is unavailable.',
			'errors.generatorMissing',
			{ category: archetypeResult.entryId },
		);
	}
	return archetype;
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
	return readNormalizedRandom(random) < MAIN_EQUIPMENT_WEAPON_CHANCE
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
	pickCarriedLoot,
	pickMainEquipment,
	populateRandomCharacter,
	selectMainEquipmentGenerator,
};

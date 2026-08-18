const generatorCatalog = require('./generatorCatalog');
const generatorResolver = require('./generatorResolver');
const {
	maybeGenerateDescriptiveModifiers,
} = require('./descriptiveModifierGenerator');
const {
	CREATURE_ROUTER_ID,
} = require('./generatorSchema');
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
const { generateStats } = require('./mechanics/statGeneration');
const { createGeneratedResources } = require('./mechanics/resources');
const { getStatProfile } = require('./statProfileCatalog');
const { randomInteger } = require('./random');

function populateRandomCreature(creature, options = {}) {
	const random = options.random ?? Math.random;
	const locale = options.locale ?? 'en';
	const requestedType = options.type;
	const resolver = options.resolver ?? generatorResolver;
	const getGenerator = options.getGenerator ?? generatorCatalog.getGenerator;
	const getProfile = options.getStatProfile ?? getStatProfile;
	generatorResolver.assertGeneratorResolverInterface(resolver);
	if (typeof resolver.resolveInlineString !== 'function') {
		throw new TypeError('Creature generation requires inline-string resolution.');
	}
	const level = options.level ?? randomInteger(1, 10, random);
	validateLevel(level);
	const router = getGenerator(CREATURE_ROUTER_ID, locale);
	const routeEntry = requestedType === undefined
		? null
		: router?.entries?.find(entry => entry.id === requestedType);
	if (!router || !Array.isArray(router.entries) || router.entries.length === 0) {
		throw creatureGenerationError(
			'Creature router is unavailable.',
			'errors.generatorMissing',
			{ category: CREATURE_ROUTER_ID },
		);
	}
	if (requestedType !== undefined && !routeEntry) {
		throw creatureGenerationError(
			`Unsupported creature type: ${requestedType}.`,
			'errors.creatureTypeInvalid',
		);
	}

	const result = resolver.generate(
		requestedType === undefined
			? `${CREATURE_ROUTER_ID}.generator`
			: `${CREATURE_ROUTER_ID}:${requestedType}`,
		locale,
		{ random },
	);
	if (!result) {
		throw creatureGenerationError(
			`Creature type route ${requestedType ?? 'random'} is unavailable.`,
			'errors.generatorMissing',
			{ category: requestedType ?? CREATURE_ROUTER_ID },
		);
	}
	const selectedType = result.provenance.find(record => (
		record.type === 'entry'
		&& record.generatorId === CREATURE_ROUTER_ID
	))?.entryId;
	const generatorId = result.generatorId;
	const generator = getGenerator(generatorId, locale);
	const entry = generator?.entries.find(candidate => candidate.id === result.entryId);
	if (!selectedType || !entry || result.outputType !== 'fields') {
		throw creatureGenerationError(
			`Creature detail generator ${generatorId} is unavailable.`,
			'errors.generatorMissing',
			{ category: generatorId },
		);
	}

	const generation = getGenerationMetadata(entry);
	const statProfileId = getGenerationStatProfileId(generation);
	const profile = getProfile(statProfileId);
	if (!profile) {
		throw creatureGenerationError(
			`Missing creature statistical profile: ${statProfileId}.`,
			'errors.generatorMissing',
			{ category: statProfileId },
		);
	}

	creature.level = level;
	const detailFields = result.displayFields ?? result.fields;
	creature.name = requireLocalizedField(detailFields, 'name');
	creature.description = requireLocalizedField(detailFields, 'description');
	creature.statistics = generateStats({ level, profile, random });
	const sourceProvenance = [...result.provenance];
	creature.traits = hasGenerationOverride(generation, 'traits')
		? resolveGenerationTemplates(generation.traits, {
			locale,
			path: 'root.generation.traits',
			random,
			resolver,
		})
		: [];
	if (hasGenerationOverride(generation, 'fixedRules')) {
		const resolvedRules = resolveFixedRules(generation.fixedRules, {
			createError: creatureGenerationError,
			includeEntryId: true,
			locale,
			path: 'root.generation.fixedRules',
			random,
			resolver,
		});
		creature.rules = resolvedRules.rules;
		sourceProvenance.push(...resolvedRules.provenance);
	}
	else {
		creature.rules = [];
	}
	creature.status.effects = hasGenerationOverride(generation, 'statusEffects')
		? resolveDescribedReferences(generation.statusEffects, {
			createError: creatureGenerationError,
			locale,
			path: 'root.generation.statusEffects',
			random,
			resolver,
		})
		: [];
	creature.status.modifiers = hasGenerationOverride(generation, 'modifiers')
		? resolveDescribedReferences(generation.modifiers, {
			createError: creatureGenerationError,
			locale,
			path: 'root.generation.modifiers',
			random,
			resolver,
		})
		: maybeGenerateDescriptiveModifiers({
			generator: 'modifier_creature',
			resolver,
			locale,
			random,
			path: 'root.creature.modifier',
		});

	let armorPercentage = generation.naturalArmorPercentage ?? 0;
	creature.gear.equipment = [];
	if (hasGenerationOverride(generation, 'armor')) {
		const resolvedArmor = resolveArmorReference(generation.armor, {
			createError: creatureGenerationError,
			locale,
			path: 'root.generation.armor',
			random,
			resolver,
		});
		armorPercentage += resolvedArmor.armorPercentage;
		creature.gear.equipment.push(resolvedArmor.value);
		sourceProvenance.push(...resolvedArmor.provenance);
	}
	if (hasGenerationOverride(generation, 'equipment')) {
		const resolvedEquipment = resolveGearReferences(generation.equipment, {
			createError: creatureGenerationError,
			locale,
			path: 'root.generation.equipment',
			random,
			resolver,
		});
		armorPercentage += resolvedEquipment.armorPercentage;
		creature.gear.equipment.push(...resolvedEquipment.values);
		sourceProvenance.push(...resolvedEquipment.provenance);
	}
	if (hasGenerationOverride(generation, 'inventory')) {
		const resolvedInventory = resolveGearReferences(generation.inventory, {
			createError: creatureGenerationError,
			locale,
			path: 'root.generation.inventory',
			random,
			resolver,
		});
		creature.gear.inventory = resolvedInventory.values;
		sourceProvenance.push(...resolvedInventory.provenance);
	}
	else {
		creature.gear.inventory = [];
	}
	Object.assign(
		creature.resources,
		createGeneratedResources(creature.statistics, level, armorPercentage),
	);
	creature.source = {
		generatorId,
		entryId: result.entryId,
		archetypeId: selectedType,
		statProfileId,
		provenance: sourceProvenance,
	};
	return creature;
}

function requireLocalizedField(fields, field) {
	const value = fields?.[field];
	if (typeof value !== 'string' || !value.trim()) {
		throw creatureGenerationError(
			`Creature generation requires localized ${field}.`,
			'errors.generatorFieldMissing',
			{ field },
		);
	}
	return value;
}

function validateLevel(level) {
	if (!Number.isInteger(level) || level < 1 || level > 10) {
		throw creatureGenerationError(
			'Creature level must be a whole number between 1 and 10.',
			'errors.creatureLevelInvalid',
		);
	}
}

function creatureGenerationError(message, translationKey, translationVariables = {}) {
	const error = new Error(message);
	error.code = 'INVALID_RANDOM_CREATURE';
	error.translationKey = translationKey;
	error.translationVariables = translationVariables;
	return error;
}

module.exports = {
	populateRandomCreature,
};

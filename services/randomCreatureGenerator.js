const generatorCatalog = require('./generatorCatalog');
const generatorResolver = require('./generatorResolver');
const {
	CREATURE_ARCHETYPE_IDS,
	CREATURE_GENERATOR_BY_ARCHETYPE,
	CREATURE_ROUTER_ID,
} = require('./generatorSchema');
const { generateStats } = require('./mechanics/characterGeneration');
const { createGeneratedResources } = require('./mechanics/resources');
const { getStatProfile } = require('./statProfileCatalog');

function populateRandomCreature(creature, options = {}) {
	const random = options.random ?? Math.random;
	const locale = options.locale ?? 'en';
	const archetype = options.archetype;
	const resolver = options.resolver ?? generatorResolver;
	const getGenerator = options.getGenerator ?? generatorCatalog.getGenerator;
	const getProfile = options.getStatProfile ?? getStatProfile;
	validateArchetype(archetype);
	const level = options.level ?? randomInteger(1, 10, random);
	validateLevel(level);

	const route = resolveGenerationReference(
		{
			generator: CREATURE_ROUTER_ID,
			entry: archetype,
			select: 'fields',
		},
		locale,
		random,
		resolver,
		'root.creature',
	);
	const generatorId = route.value?.Generator;
	if (generatorId !== CREATURE_GENERATOR_BY_ARCHETYPE[archetype]) {
		throw creatureGenerationError(
			`Creature archetype route ${archetype} is unavailable.`,
			'errors.generatorMissing',
			{ category: archetype },
		);
	}
	const result = resolveGenerationReference(
		{ generator: generatorId, select: 'fields' },
		locale,
		random,
		resolver,
		'root.creature.details',
	);
	const selection = getEntrySelection(result.provenance);
	const generator = getGenerator(generatorId, locale);
	const entry = generator?.entries.find(candidate => candidate.id === selection.entryId);
	if (!entry?.generation || !result.value) {
		throw creatureGenerationError(
			`Creature detail generator ${generatorId} is unavailable.`,
			'errors.generatorMissing',
			{ category: generatorId },
		);
	}

	const generation = entry.generation;
	const profile = getProfile(generation.statProfile);
	if (!profile) {
		throw creatureGenerationError(
			`Missing creature statistical profile: ${generation.statProfile}.`,
			'errors.generatorMissing',
			{ category: generation.statProfile },
		);
	}

	creature.level = level;
	creature.name = requireLocalizedField(result.value, 'Name');
	creature.description = requireLocalizedField(result.value, 'Description');
	creature.statistics = generateStats({ level, profile, random });
	creature.traits = generation.traits.map(trait => ({
		id: trait.id,
		name: trait.Name,
		description: trait.Description,
	}));
	creature.rules = [];
	creature.status.effects = [];
	creature.modifiers = result.modifiers.map(modifier => structuredClone(modifier));

	const sourceProvenance = [...route.provenance, ...result.provenance];
	resolveFixedRules(
		creature,
		generation.fixedRules ?? [],
		locale,
		random,
		resolver,
		sourceProvenance,
	);
	resolveStatusEffects(
		creature,
		generation.statusEffects ?? [],
		locale,
		random,
		resolver,
	);

	let armorPercentage = generation.naturalArmorPercentage ?? 0;
	creature.naturalArmor = {
		percentage: generation.naturalArmorPercentage ?? 0,
	};
	creature.gear.equipment = [];
	if (generation.armor) {
		const resolvedArmor = resolveGenerationReference(
			generation.armor,
			locale,
			random,
			resolver,
			'root.generation.armor',
		);
		armorPercentage = requireTechnicalNumber(
			resolvedArmor.value,
			'AR percentage',
		);
		creature.gear.equipment.push(formatReferenceValue(resolvedArmor.value));
		sourceProvenance.push(...resolvedArmor.provenance);
	}
	creature.gear.equipment.push(...resolveGearReferences(
		generation.equipment,
		locale,
		random,
		resolver,
		'root.generation.equipment',
		sourceProvenance,
	));
	creature.gear.inventory = resolveGearReferences(
		generation.inventory,
		locale,
		random,
		resolver,
		'root.generation.inventory',
		sourceProvenance,
	);
	Object.assign(
		creature.status,
		createGeneratedResources(creature.statistics, level, armorPercentage),
	);
	creature.source = {
		generatorId,
		entryId: selection.entryId,
		archetypeId: archetype,
		statProfileId: generation.statProfile,
		provenance: sourceProvenance,
	};
	return creature;
}

function resolveFixedRules(
	creature,
	fixedRules,
	locale,
	random,
	resolver,
	sourceProvenance,
) {
	for (const [index, fixedRule] of fixedRules.entries()) {
		const resolved = resolveGenerationReference(
			{
				generator: 'rules',
				entry: fixedRule.entry,
				select: 'fields',
			},
			locale,
			random,
			resolver,
			`root.generation.fixedRules.${index}`,
		);
		creature.rules.push({
			entryId: fixedRule.entry,
			name: requireLocalizedField(resolved.value, 'Name'),
			description: requireLocalizedField(resolved.value, 'Description'),
			level: fixedRule.level,
		});
		sourceProvenance.push(...resolved.provenance);
	}
}

function resolveStatusEffects(creature, references, locale, random, resolver) {
	for (const [index, reference] of references.entries()) {
		const resolved = resolveGenerationReference(
			reference,
			locale,
			random,
			resolver,
			`root.generation.statusEffects.${index}`,
		);
		const selection = getEntrySelection(resolved.provenance);
		creature.status.effects.push({
			generatorId: selection.generatorId,
			entryId: selection.entryId,
			name: requireLocalizedField(resolved.value, 'Name'),
			description: requireLocalizedField(resolved.value, 'Description'),
			provenance: resolved.provenance,
		});
	}
}

function resolveGearReferences(
	references,
	locale,
	random,
	resolver,
	path,
	sourceProvenance,
) {
	return references.map((reference, index) => {
		const resolved = resolveGenerationReference(
			reference,
			locale,
			random,
			resolver,
			`${path}.${index}`,
		);
		sourceProvenance.push(...resolved.provenance);
		return formatReferenceValue(resolved.value);
	});
}

function resolveGenerationReference(reference, locale, random, resolver, path) {
	return resolver.resolveReference(reference, locale, { path, random });
}

function formatReferenceValue(value) {
	if (typeof value === 'string') {
		return value;
	}
	return `${requireLocalizedField(value, 'Name')} — `
		+ requireLocalizedField(value, 'Description');
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

function requireTechnicalNumber(fields, field) {
	const value = fields?.[field];
	if (!Number.isFinite(value)) {
		throw creatureGenerationError(
			`Creature generation requires numeric ${field}.`,
			'errors.generatorFieldMissing',
			{ field },
		);
	}
	return value;
}

function getEntrySelection(provenance) {
	const selection = provenance.find(record => record.type === 'entry' && record.entryId);
	if (!selection) {
		throw creatureGenerationError(
			'Creature generation reference omitted selection provenance.',
			'errors.generatorMissing',
			{ category: 'provenance' },
		);
	}
	return selection;
}

function validateArchetype(archetype) {
	if (!CREATURE_ARCHETYPE_IDS.includes(archetype)) {
		throw creatureGenerationError(
			`Unsupported creature archetype: ${archetype}.`,
			'errors.creatureArchetypeInvalid',
		);
	}
}

function validateLevel(level) {
	if (!Number.isInteger(level) || level < 1 || level > 10) {
		throw creatureGenerationError(
			'Creature level must be a whole number between 1 and 10.',
			'errors.creatureLevelInvalid',
		);
	}
}

function randomInteger(minimum, maximum, random) {
	const value = Math.max(0, Math.min(0.9999999999999999, random()));
	return minimum + Math.floor(value * (maximum - minimum + 1));
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

const generatorCatalog = require('./generatorCatalog');
const generatorResolver = require('./generatorResolver');
const {
	maybeGenerateDescriptiveModifiers,
} = require('./descriptiveModifierGenerator');
const {
	CREATURE_ROUTER_ID,
} = require('./generatorSchema');
const {
	parseWrappedInlineReference,
} = require('./generatorSchema/referenceValidation');
const { generateStats } = require('./mechanics/characterGeneration');
const { createGeneratedResources } = require('./mechanics/resources');
const { getStatProfile } = require('./statProfileCatalog');

function populateRandomCreature(creature, options = {}) {
	const random = options.random ?? Math.random;
	const locale = options.locale ?? 'en';
	const requestedType = options.type;
	const resolver = options.resolver ?? generatorResolver;
	const getGenerator = options.getGenerator ?? generatorCatalog.getGenerator;
	const getProfile = options.getStatProfile ?? getStatProfile;
	generatorResolver.assertGeneratorResolverInterface(resolver);
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

	const route = resolveGenerationReference(
		{
			generator: CREATURE_ROUTER_ID,
			...(requestedType === undefined ? {} : { entry: requestedType }),
			select: 'fields',
		},
		locale,
		random,
		resolver,
		'root.creature',
	);
	const selectedType = getEntrySelection(route.provenance).entryId;
	const routeExpression = route.fields?.generator ?? route.value?.generator;
	let parsedRoute = null;
	try {
		parsedRoute = parseWrappedInlineReference(routeExpression, 'creature route');
	}
	catch {
		// The route-specific generation error below describes unavailable routes.
	}
	if (
		!parsedRoute
		|| parsedRoute.entry
		|| parsedRoute.field
		|| !parsedRoute.generator
	) {
		throw creatureGenerationError(
			`Creature type route ${selectedType} is unavailable.`,
			'errors.generatorMissing',
			{ category: selectedType },
		);
	}
	const result = resolver.resolveInlineReference(
		routeExpression,
		locale,
		{ path: 'root.creature.details', random },
	);
	const selection = getEntrySelection(result.provenance);
	const generatorId = selection.generatorId;
	if (generatorId !== parsedRoute.generator) {
		throw creatureGenerationError(
			`Creature type route ${selectedType} resolved to an unexpected generator.`,
			'errors.generatorMissing',
			{ category: selectedType },
		);
	}
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
	const detailFields = result.fields ?? result.value;
	creature.name = requireLocalizedField(detailFields, 'name');
	creature.description = requireLocalizedField(detailFields, 'description');
	creature.statistics = generateStats({ level, profile, random });
	creature.traits = generation.traits.map(trait => ({
		id: trait.id,
		name: trait.name,
		description: trait.description,
	}));
	creature.rules = [];
	creature.status.effects = [];
	creature.status.modifiers = maybeGenerateDescriptiveModifiers({
		generator: 'modifier_creature',
		resolver,
		locale,
		random,
		path: 'root.creature.modifier',
	});

	const sourceProvenance = [...route.provenance, ...result.provenance];
	resolveFixedRules(
		creature,
		generation.fixedRules ?? [],
		locale,
		random,
		resolver,
		sourceProvenance,
	);
	creature.status.effects.push(...resolveDescribedReferences(
		generation.statusEffects ?? [],
		locale,
		random,
		resolver,
		'root.generation.statusEffects',
	));
	creature.status.modifiers.push(...resolveDescribedReferences(
		generation.modifiers ?? [],
		locale,
		random,
		resolver,
		'root.generation.modifiers',
	));

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
			'ar_percentage',
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
		creature.resources,
		createGeneratedResources(creature.statistics, level, armorPercentage),
	);
	creature.source = {
		generatorId,
		entryId: selection.entryId,
		archetypeId: selectedType,
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
			name: requireLocalizedField(resolved.value, 'name'),
			description: requireLocalizedField(resolved.value, 'description'),
			level: fixedRule.level,
		});
		sourceProvenance.push(...resolved.provenance);
	}
}

function resolveDescribedReferences(references, locale, random, resolver, path) {
	return references.map((reference, index) => {
		const resolved = resolveGenerationReference(
			reference,
			locale,
			random,
			resolver,
			`${path}.${index}`,
		);
		const selection = getEntrySelection(resolved.provenance);
		return {
			generatorId: selection.generatorId,
			entryId: selection.entryId,
			name: requireLocalizedField(resolved.value, 'name'),
			description: requireLocalizedField(resolved.value, 'description'),
			provenance: resolved.provenance,
		};
	});
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
	return `${requireLocalizedField(value, 'name')} — `
		+ requireLocalizedField(value, 'description');
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

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
	resolveGenerationMetadata,
} = require('./generationMetadata');
const { createGeneratedResources } = require('./mechanics/resources');
const { randomInteger } = require('./random');

function populateRandomCreature(creature, options = {}) {
	const random = options.random ?? Math.random;
	const locale = options.locale ?? 'en';
	const requestedType = options.type;
	const resolver = options.resolver ?? generatorResolver;
	const getGenerator = options.getGenerator ?? generatorCatalog.getGenerator;
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

	creature.level = level;
	const detailFields = result.displayFields ?? result.fields;
	creature.name = requireLocalizedField(detailFields, 'name');
	creature.description = requireLocalizedField(detailFields, 'description');
	const resolvedGeneration = resolveGenerationMetadata({
		entityType: 'creature',
		generation,
		level,
		locale,
		random,
		resolver,
		getProfile: options.getStatProfile ?? undefined,
		createError: creatureGenerationError,
		defaults: {
			includeRuleEntryId: true,
			modifiers({ locale: modifierLocale, random: modifierRandom, resolver: modifierResolver }) {
				return maybeGenerateDescriptiveModifiers({
					generator: 'modifier_creature',
					resolver: modifierResolver,
					locale: modifierLocale,
					random: modifierRandom,
					path: 'root.creature.modifier',
				});
			},
		},
	});
	creature.statistics = resolvedGeneration.statistics;
	creature.traits = resolvedGeneration.templates;
	creature.rules = resolvedGeneration.rules;
	creature.status.effects = resolvedGeneration.statusEffects;
	creature.status.modifiers = resolvedGeneration.modifiers;
	creature.gear.equipment = resolvedGeneration.gear.armor === undefined
		? resolvedGeneration.gear.equipment
		: [resolvedGeneration.gear.armor, ...resolvedGeneration.gear.equipment];
	creature.gear.inventory = resolvedGeneration.gear.inventory;
	Object.assign(
		creature.resources,
		createGeneratedResources(
			creature.statistics,
			level,
			resolvedGeneration.armorPercentage,
		),
	);
	creature.source = {
		generatorId,
		entryId: result.entryId,
		archetypeId: selectedType,
		statProfileId: resolvedGeneration.statProfileId,
		provenance: [...result.provenance, ...resolvedGeneration.provenance],
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

const DEFAULT_STAT_PROFILE_ID = 'default';

const {
	resolveArmorReference,
	resolveDescribedReferences,
	resolveFixedRules,
	resolveGearReferences,
	resolveGenerationTemplates,
} = require('./generationReferenceResolver');
const { generateStats } = require('./mechanics/statGeneration');
const { getStatProfile } = require('./statProfileCatalog');

const COMMON_GENERATION_PROPERTIES = Object.freeze([
	'statProfile',
	'naturalArmorPercentage',
	'fixedRules',
	'statusEffects',
	'modifiers',
	'armor',
	'equipment',
	'inventory',
]);

const TEMPLATE_PROPERTY_BY_ENTITY_TYPE = Object.freeze({
	character: 'talents',
	creature: 'traits',
});

function getGenerationMetadata(entry) {
	return entry?.generation ?? {};
}

function getGenerationStatProfileId(generation) {
	return generation?.statProfile ?? DEFAULT_STAT_PROFILE_ID;
}

function hasGenerationOverride(generation, property) {
	return Boolean(generation && Object.hasOwn(generation, property));
}

function resolveGenerationMetadata({
	entityType,
	generation,
	level,
	locale,
	random = Math.random,
	resolver,
	getProfile = getStatProfile,
	createError,
	defaults = {},
	categoryOrder = [
		'templates',
		'fixedRules',
		'statusEffects',
		'modifiers',
		'armor',
		'equipment',
		'inventory',
	],
	preStatisticsCategories = [],
}) {
	const templateProperty = TEMPLATE_PROPERTY_BY_ENTITY_TYPE[entityType];
	if (!templateProperty) {
		throw new TypeError(`Unsupported generation metadata entity type: ${entityType}.`);
	}
	const metadata = generation ?? {};
	const statProfileId = getGenerationStatProfileId(metadata);
	const profile = getProfile(statProfileId);
	if (!profile) {
		throw createMissingProfileError(
			createError,
			entityType,
			statProfileId,
		);
	}

	const context = {
		entityType,
		generation: metadata,
		level,
		locale,
		random,
		resolver,
		statistics: undefined,
	};
	const resolved = {
		statProfileId,
		profile,
		statistics: undefined,
		templates: [],
		rules: [],
		statusEffects: [],
		modifiers: [],
		gear: {
			armor: undefined,
			equipment: [],
			inventory: [],
		},
		naturalArmorPercentage: metadata.naturalArmorPercentage ?? 0,
		armorPercentage: metadata.naturalArmorPercentage ?? 0,
		provenance: [],
	};

	for (const category of preStatisticsCategories) {
		if (categoryOrder.includes(category)) {
			resolveCategory(category, {
				entityType,
				metadata,
				templateProperty,
				context,
				resolved,
				createError,
				defaults,
			});
		}
	}
	if (typeof defaults.beforeStatistics === 'function') {
		defaults.beforeStatistics(context);
	}

	resolved.statistics = generateStats({ level, profile, random });
	context.statistics = resolved.statistics;

	for (const category of categoryOrder) {
		if (!preStatisticsCategories.includes(category)) {
			resolveCategory(category, {
				entityType,
				metadata,
				templateProperty,
				context,
				resolved,
				createError,
				defaults,
			});
		}
	}

	return resolved;
}

function resolveCategory(category, {
	metadata,
	templateProperty,
	context,
	resolved,
	createError,
	defaults,
} = {}) {
	const options = {
		createError,
		locale: context.locale,
		path: `root.generation.${category === 'templates' ? templateProperty : category}`,
		random: context.random,
		resolver: context.resolver,
	};

	switch (category) {
	case 'templates':
		resolved.templates = hasGenerationOverride(metadata, templateProperty)
			? resolveGenerationTemplates(metadata[templateProperty], options)
			: resolveDefault(defaults.templates, context, []);
		return;
	case 'fixedRules':
		if (hasGenerationOverride(metadata, 'fixedRules')) {
			const fixedRules = resolveFixedRules(metadata.fixedRules, {
				...options,
				includeEntryId: Boolean(defaults.includeRuleEntryId),
			});
			resolved.rules = fixedRules.rules;
			resolved.provenance.push(...fixedRules.provenance);
		}
		else {
			resolved.rules = resolveDefault(defaults.fixedRules, context, []);
		}
		return;
	case 'statusEffects':
		resolved.statusEffects = hasGenerationOverride(metadata, 'statusEffects')
			? resolveDescribedReferences(metadata.statusEffects, options)
			: resolveDefault(defaults.statusEffects, context, []);
		return;
	case 'modifiers':
		resolved.modifiers = hasGenerationOverride(metadata, 'modifiers')
			? resolveDescribedReferences(metadata.modifiers, options)
			: resolveDefault(defaults.modifiers, context, []);
		return;
	case 'armor':
		resolveGearCategory('armor', metadata, context, resolved, options, defaults);
		return;
	case 'equipment':
		resolveGearCategory('equipment', metadata, context, resolved, options, defaults);
		return;
	case 'inventory':
		resolveGearCategory('inventory', metadata, context, resolved, options, defaults);
		return;
	default:
		throw new TypeError(`Unsupported generation metadata category: ${category}.`);
	}
}

function resolveGearCategory(category, metadata, context, resolved, options, defaults) {
	const hasOverride = hasGenerationOverride(metadata, category);
	if (category === 'armor') {
		const armor = hasOverride
			? resolveArmorReference(metadata.armor, options)
			: resolveDefault(defaults.armor, context, {});
		resolved.gear.armor = armor.value;
		resolved.armorPercentage += armor.armorPercentage ?? 0;
		if (hasOverride) {
			resolved.provenance.push(...(armor.provenance ?? []));
		}
		return;
	}

	const gear = hasOverride
		? resolveGearReferences(metadata[category], options)
		: resolveDefault(defaults[category], context, { values: [] });
	resolved.gear[category] = gear.values ?? [];
	if (category !== 'inventory') {
		resolved.armorPercentage += gear.armorPercentage ?? 0;
	}
	if (hasOverride) {
		resolved.provenance.push(...(gear.provenance ?? []));
	}
}

function resolveDefault(generator, context, fallback) {
	return typeof generator === 'function' ? generator(context) : fallback;
}

function createMissingProfileError(createError, entityType, statProfileId) {
	const label = entityType === 'creature' ? 'creature ' : '';
	if (typeof createError === 'function') {
		return createError(
			`Missing ${label}statistical profile: ${statProfileId}.`,
			'errors.generatorMissing',
			{ category: statProfileId },
		);
	}
	return new Error(`Missing ${label}statistical profile: ${statProfileId}.`);
}

module.exports = {
	COMMON_GENERATION_PROPERTIES,
	DEFAULT_STAT_PROFILE_ID,
	TEMPLATE_PROPERTY_BY_ENTITY_TYPE,
	getGenerationMetadata,
	getGenerationStatProfileId,
	hasGenerationOverride,
	resolveGenerationMetadata,
};

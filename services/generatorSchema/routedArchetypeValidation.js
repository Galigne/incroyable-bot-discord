const { getGenerationStatProfileId } = require('../generationMetadata');
const {
	generatorSchemaError,
} = require('./assertions');
const {
	validateGenerationMetadata,
} = require('./generationMetadataValidation');
const {
	validateGenerationRelationships,
} = require('./generationRelationshipValidation');
const {
	BACKGROUND_ROUTER_ID,
	CREATURE_ROUTER_ID,
} = require('./constants');

const BACKGROUND_ROUTED_ARCHETYPE = {
	key: 'background',
	routerId: BACKGROUND_ROUTER_ID,
	generatorIdsOption: 'backgroundGeneratorIds',
	entityType: 'character',
	templateProperty: 'talents',
	routerErrorCode: 'INVALID_BACKGROUND_ROUTER_SCHEMA',
	routerErrorMessage: file => (
		`Background router ${file} must be a public structural router.`
	),
	childErrorCode: 'INVALID_BACKGROUND_ARCHETYPE_SCHEMA',
	childErrorMessage: file => (
		`Background archetype generator ${file} must be internal and name-only.`
	),
	routeMissingCode: 'BACKGROUND_ROUTER_MISSING',
	routeMissingMessage: locale => (
		`Character generation is missing the ${locale} ${BACKGROUND_ROUTER_ID} router.`
	),
	routeInvalidCode: 'BACKGROUND_ROUTE_INVALID',
	routeInvalidMessage: (locale, route) => (
		`Character generation has an invalid ${locale} ${route?.id} background route.`
	),
	childMissingCode: 'BACKGROUND_ARCHETYPE_MISSING',
	childMissingMessage: (locale, generatorId) => (
		`Character generation is missing the ${locale} ${generatorId} archetype generator.`
	),
	profileMissingCode: 'BACKGROUND_STAT_PROFILE_MISSING',
	profileMissingMessage: (generatorId, entryId) => (
		`Background archetype ${generatorId}:${entryId} references an unknown statistical profile.`
	),
	profileValidationLabel: 'Background',
	routeEntriesInvalidMessage: locale => (
		`Character generation has invalid ${locale} background router entries.`
	),
	entrySchemaMatches: entrySchema => entrySchema.required.length === 0,
};

const CREATURE_ROUTED_ARCHETYPE = {
	key: 'creature',
	routerId: CREATURE_ROUTER_ID,
	generatorIdsOption: 'creatureGeneratorIds',
	entityType: 'creature',
	templateProperty: 'traits',
	routerErrorCode: 'INVALID_CREATURE_ROUTER_SCHEMA',
	routerErrorMessage: file => (
		`Creature router ${file} must be a public structural router.`
	),
	childErrorCode: 'INVALID_CREATURE_ARCHETYPE_SCHEMA',
	childErrorMessage: file => (
		`Creature detail generator ${file} must be internal with localized names and description fields.`
	),
	routeMissingCode: 'CREATURE_ROUTER_MISSING',
	routeMissingMessage: locale => (
		`Creature generation is missing the ${locale} ${CREATURE_ROUTER_ID} router.`
	),
	routeInvalidCode: 'CREATURE_ROUTE_INVALID',
	routeInvalidMessage: (locale, route) => (
		`Creature generation has an invalid ${locale} ${route?.id} route.`
	),
	childMissingCode: 'CREATURE_ARCHETYPE_MISSING',
	childMissingMessage: (locale, generatorId) => (
		`Creature generation is missing the ${locale} ${generatorId} archetype.`
	),
	profileMissingCode: 'CREATURE_STAT_PROFILE_MISSING',
	profileMissingMessage: (generatorId, entryId) => (
		`Creature archetype ${generatorId}:${entryId} references an unknown statistical profile.`
	),
	profileValidationLabel: 'Creature',
	routeEntriesInvalidMessage: locale => (
		`Creature generation has invalid ${locale} router entries.`
	),
	entrySchemaMatches: entrySchema => JSON.stringify(entrySchema.required)
		=== JSON.stringify(['description']),
};

const ROUTED_ARCHETYPE_DEFINITIONS = Object.freeze([
	BACKGROUND_ROUTED_ARCHETYPE,
	CREATURE_ROUTED_ARCHETYPE,
]);

function getRoutedArchetypeDefinitionForGenerator(
	generatorId,
	options = {},
	{ includeRouter = false } = {},
) {
	return getRoutedArchetypeDefinitionsForGenerator(
		generatorId,
		options,
		{ includeRouter },
	)[0];
}

function getRoutedArchetypeDefinitionsForGenerator(
	generatorId,
	options = {},
	{ includeRouter = false } = {},
) {
	return ROUTED_ARCHETYPE_DEFINITIONS.filter(definition => (
		(includeRouter && generatorId === definition.routerId)
		|| isRoutedArchetypeGenerator(generatorId, options, definition)
	));
}

function isRoutedArchetypeGenerator(generatorId, options, definition) {
	return options?.[definition.generatorIdsOption] instanceof Set
		&& options[definition.generatorIdsOption].has(generatorId);
}

function validateRoutedArchetypeGeneratorEnvelope(
	generator,
	entrySchema,
	file,
	options = {},
	routedArchetypeDefinition,
) {
	const definitions = routedArchetypeDefinition
		? [routedArchetypeDefinition]
		: getRoutedArchetypeDefinitionsForGenerator(
			generator.id,
			options,
			{ includeRouter: true },
		);
	if (definitions.length === 0) {
		return;
	}
	for (const definition of definitions) {
		if (generator.id === definition.routerId) {
			if (generator.visibility !== 'public' || !options.isRouter) {
				throw generatorSchemaError(
					definition.routerErrorCode,
					definition.routerErrorMessage(file),
				);
			}
			continue;
		}
		if (
			generator.visibility !== 'internal'
			|| options.isRouter
			|| !definition.entrySchemaMatches(entrySchema)
		) {
			throw generatorSchemaError(
				definition.childErrorCode,
				definition.childErrorMessage(file),
			);
		}
	}
}

function validateRoutedArchetypeGeneration(generation, location, definition) {
	validateGenerationMetadata(generation, location, definition.entityType);
}

function discoverRoutedArchetypeGeneratorIds(definitions, definition) {
	const router = definitions.find(({ english }) => (
		english.id === definition.routerId
	))?.english;
	if (router?.visibility !== 'public') {
		return new Set();
	}
	return new Set(
		router.entries
			?.map(entry => entry.generator)
			.filter(Boolean)
		?? [],
	);
}

function createRoutedArchetypeValidationOptions(definitions) {
	return Object.fromEntries(ROUTED_ARCHETYPE_DEFINITIONS.map(definition => [
		definition.generatorIdsOption,
		discoverRoutedArchetypeGeneratorIds(definitions, definition),
	]));
}

function forEachRoutedArchetypeEntry(
	catalog,
	definition,
	locale,
	callback,
	{ strict = false } = {},
) {
	const router = catalog.get(definition.routerId);
	if (!router) {
		if (strict) {
			throw generatorSchemaError(
				definition.routeMissingCode,
				definition.routeMissingMessage(locale),
			);
		}
		return;
	}
	if (!Array.isArray(router.entries) || router.entries.length === 0) {
		if (strict) {
			throw generatorSchemaError(
				definition.routeInvalidCode,
				definition.routeEntriesInvalidMessage(locale),
			);
		}
		return;
	}
	for (const route of router.entries) {
		const generatorId = route.generator;
		if (!generatorId) {
			if (strict) {
				throw generatorSchemaError(
					definition.routeInvalidCode,
					definition.routeInvalidMessage(locale, route),
				);
			}
			continue;
		}
		const generator = catalog.get(generatorId);
		if (!generator) {
			if (strict) {
				throw generatorSchemaError(
					definition.childMissingCode,
					definition.childMissingMessage(locale, generatorId),
				);
			}
			continue;
		}
		for (const entry of generator.entries) {
			callback(generator, entry, route);
		}
	}
}

function validateRoutedArchetypeStatProfileRelationships(
	catalogs,
	profiles,
	definitions = ROUTED_ARCHETYPE_DEFINITIONS,
) {
	const selectedDefinitions = Array.isArray(definitions)
		? definitions
		: [definitions];
	if (!(catalogs instanceof Map) || !(profiles instanceof Map)) {
		throw new TypeError('Routed archetype profile validation requires catalog and profile maps.');
	}
	for (const definition of selectedDefinitions) {
		for (const locale of ['en', 'fr']) {
			const catalog = catalogs.get(locale);
			if (!(catalog instanceof Map)) {
				throw new TypeError(
					`${selectedDefinitions.length === 1
						? definition.profileValidationLabel
						: 'Routed archetype'} profile validation is missing the ${locale} catalog.`,
				);
			}
			forEachRoutedArchetypeEntry(
				catalog,
				definition,
				locale,
				(generator, entry) => {
					const profileId = getGenerationStatProfileId(entry.generation);
					if (!profiles.has(profileId)) {
						throw generatorSchemaError(
							definition.profileMissingCode,
							definition.profileMissingMessage(generator.id, entry.id),
						);
					}
				},
				{ strict: true },
			);
		}
	}
	return true;
}

function validateRoutedArchetypeRelationships(catalog, validateReferenceRelationship) {
	const visitedGeneratorIds = new Set();
	for (const definition of ROUTED_ARCHETYPE_DEFINITIONS) {
		forEachRoutedArchetypeEntry(
			catalog,
			definition,
			undefined,
			generator => {
				if (visitedGeneratorIds.has(generator.id)) {
					return;
				}
				visitedGeneratorIds.add(generator.id);
				for (const routedEntry of generator.entries) {
					validateGenerationRelationships(
						generator,
						routedEntry,
						catalog,
						validateReferenceRelationship,
					);
				}
			},
		);
	}
}

module.exports = {
	BACKGROUND_ROUTED_ARCHETYPE,
	CREATURE_ROUTED_ARCHETYPE,
	ROUTED_ARCHETYPE_DEFINITIONS,
	createRoutedArchetypeValidationOptions,
	discoverRoutedArchetypeGeneratorIds,
	forEachRoutedArchetypeEntry,
	getRoutedArchetypeDefinitionForGenerator,
	getRoutedArchetypeDefinitionsForGenerator,
	isRoutedArchetypeGenerator,
	validateRoutedArchetypeGeneratorEnvelope,
	validateRoutedArchetypeGeneration,
	validateRoutedArchetypeRelationships,
	validateRoutedArchetypeStatProfileRelationships,
};

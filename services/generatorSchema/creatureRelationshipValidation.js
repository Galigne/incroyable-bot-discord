const { generatorSchemaError } = require('./assertions');
const {
	CREATURE_ROUTER_ID,
} = require('./constants');
const { parseInlineReference } = require('./referenceValidation');

function validateCreatureGenerationRelationships(
	generator,
	entry,
	catalog,
	validateReferenceRelationship,
) {
	const generation = entry.generation;
	const ownerId = `${generator.id}:${entry.id}`;
	const rules = catalog.get('rules');
	if (
		generation.fixedRules?.some(rule => (
			!rules
			|| rules.entrySchema.type !== 'fields'
			|| !rules.entrySchema.required.includes('name')
			|| !rules.entrySchema.required.includes('description')
			|| !rules.entries.some(candidate => candidate.id === rule.entry)
		))
	) {
		throw generatorSchemaError(
			'GENERATOR_ENTRY_NOT_FOUND',
			`Creature archetype ${ownerId} references an unknown fixed RULE.`,
		);
	}
	for (const reference of generation.statusEffects ?? []) {
		const sources = validateReferenceRelationship(reference, catalog, ownerId);
		assertReferenceFields(sources, ['name', 'description'], ownerId, 'status effect');
	}
	for (const reference of generation.modifiers ?? []) {
		const sources = validateReferenceRelationship(reference, catalog, ownerId);
		assertReferenceFields(sources, ['name', 'description'], ownerId, 'modifier');
	}
	if (generation.armor) {
		const sources = validateReferenceRelationship(generation.armor, catalog, ownerId);
		assertReferenceFields(
			sources,
			['name', 'description', 'ar_percentage'],
			ownerId,
			'armor',
		);
	}
	for (const reference of [
		...generation.equipment,
		...generation.inventory,
	]) {
		const sources = validateReferenceRelationship(reference, catalog, ownerId);
		assertGearReferenceResult(sources, reference.select, ownerId);
	}
}

function assertReferenceFields(sources, fields, ownerId, label) {
	if (sources.some(source => (
		source.entrySchema.type !== 'fields'
		|| fields.some(field => !source.entrySchema.required.includes(field))
	))) {
		throw generatorSchemaError(
			'INVALID_CREATURE_REFERENCE_TARGET',
			`Creature archetype ${ownerId} has an invalid ${label} reference.`,
		);
	}
}

function assertGearReferenceResult(sources, selector, ownerId) {
	if (selector === 'value' || selector === 'display') {
		return;
	}
	if (selector === 'fields') {
		assertReferenceFields(sources, ['name', 'description'], ownerId, 'gear');
		return;
	}
	const field = selector.slice('fields.'.length);
	if (sources.some(source => source.entries.some(entry => (
		typeof entry.fields?.[field] !== 'string'
	)))) {
		throw generatorSchemaError(
			'INVALID_CREATURE_REFERENCE_TARGET',
			`Creature archetype ${ownerId} has a non-text gear reference.`,
		);
	}
}

function validateCreatureStatProfileRelationships(catalogs, profiles) {
	if (!(catalogs instanceof Map) || !(profiles instanceof Map)) {
		throw new TypeError('Creature profile validation requires catalog and profile maps.');
	}
	for (const locale of ['en', 'fr']) {
		const catalog = catalogs.get(locale);
		if (!(catalog instanceof Map)) {
			throw new TypeError(`Creature profile validation is missing the ${locale} catalog.`);
		}
		const router = catalog.get(CREATURE_ROUTER_ID);
		if (!router) {
			throw generatorSchemaError(
				'CREATURE_ROUTER_MISSING',
				`Creature generation is missing the ${locale} ${CREATURE_ROUTER_ID} router.`,
			);
		}
		if (!Array.isArray(router.entries) || router.entries.length === 0) {
			throw generatorSchemaError(
				'CREATURE_ROUTE_INVALID',
				`Creature generation has invalid ${locale} router entries.`,
			);
		}
		for (const route of router.entries) {
			const archetypeId = route.id;
			const routeExpression = route?.fields?.generator;
			const routeReference = typeof routeExpression === 'string'
				? parseInlineReference(
					routeExpression.replace(/^\s*\{\{([^{}]+)\}\}\s*$/, '$1'),
					`${locale} creature route`,
				)
				: null;
			const generatorId = routeReference?.generator;
			if (
				!routeReference
				|| routeReference.entry
				|| routeReference.field
				|| !generatorId
			) {
				throw generatorSchemaError(
					'CREATURE_ROUTE_INVALID',
					`Creature generation has an invalid ${locale} ${archetypeId} route.`,
				);
			}
			const generator = catalog.get(generatorId);
			if (!generator) {
				throw generatorSchemaError(
					'CREATURE_ARCHETYPE_MISSING',
					`Creature generation is missing the ${locale} ${generatorId} archetype.`,
				);
			}
			for (const entry of generator.entries) {
				if (!profiles.has(entry.generation.statProfile)) {
					throw generatorSchemaError(
						'CREATURE_STAT_PROFILE_MISSING',
						`Creature archetype ${generatorId}:${entry.id} references an unknown statistical profile.`,
					);
				}
			}
		}
	}
	return true;
}

module.exports = {
	validateCreatureGenerationRelationships,
	validateCreatureStatProfileRelationships,
};

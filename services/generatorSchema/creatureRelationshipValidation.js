const { generatorSchemaError } = require('./assertions');
const { getGenerationStatProfileId } = require('../generationMetadata');
const {
	CREATURE_ROUTER_ID,
} = require('./constants');
const {
	validateGenerationRelationships,
} = require('./generationRelationshipValidation');

function validateCreatureGenerationRelationships(
	generator,
	entry,
	catalog,
	validateReferenceRelationship,
) {
	validateGenerationRelationships(
		generator,
		entry,
		catalog,
		validateReferenceRelationship,
	);
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
			const typeId = route.id;
			const generatorId = route.generator;
			if (!generatorId) {
				throw generatorSchemaError(
					'CREATURE_ROUTE_INVALID',
					`Creature generation has an invalid ${locale} ${typeId} route.`,
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
				const profileId = getGenerationStatProfileId(entry.generation);
				if (!profiles.has(profileId)) {
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

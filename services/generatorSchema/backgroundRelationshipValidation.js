const { generatorSchemaError } = require('./assertions');
const { getGenerationStatProfileId } = require('../generationMetadata');
const { BACKGROUND_ROUTER_ID } = require('./constants');

function validateBackgroundStatProfileRelationships(catalogs, profiles) {
	if (!(catalogs instanceof Map) || !(profiles instanceof Map)) {
		throw new TypeError('Background profile validation requires catalog and profile maps.');
	}
	for (const locale of ['en', 'fr']) {
		const catalog = catalogs.get(locale);
		if (!(catalog instanceof Map)) {
			throw new TypeError(`Background profile validation is missing the ${locale} catalog.`);
		}
		const router = catalog.get(BACKGROUND_ROUTER_ID);
		if (!router) {
			throw generatorSchemaError(
				'BACKGROUND_ROUTER_MISSING',
				`Character generation is missing the ${locale} ${BACKGROUND_ROUTER_ID} router.`,
			);
		}
		if (!Array.isArray(router.entries) || router.entries.length === 0) {
			throw generatorSchemaError(
				'BACKGROUND_ROUTE_INVALID',
				`Character generation has invalid ${locale} background router entries.`,
			);
		}
		for (const route of router.entries) {
			const generatorId = route.generator;
			if (!generatorId) {
				throw generatorSchemaError(
					'BACKGROUND_ROUTE_INVALID',
					`Character generation has an invalid ${locale} ${route.id} background route.`,
				);
			}
			const generator = catalog.get(generatorId);
			if (!generator) {
				throw generatorSchemaError(
					'BACKGROUND_ARCHETYPE_MISSING',
					`Character generation is missing the ${locale} ${generatorId} archetype generator.`,
				);
			}
			for (const entry of generator.entries) {
				const profileId = getGenerationStatProfileId(entry.generation);
				if (!profiles.has(profileId)) {
					throw generatorSchemaError(
						'BACKGROUND_STAT_PROFILE_MISSING',
						`Background archetype ${generatorId}:${entry.id} references an unknown statistical profile.`,
					);
				}
			}
		}
	}
	return true;
}

module.exports = { validateBackgroundStatProfileRelationships };

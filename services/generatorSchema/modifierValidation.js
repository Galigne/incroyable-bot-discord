const {
	assertExactKeys,
	assertPlainObject,
	generatorSchemaError,
	validateTechnicalId,
} = require('./assertions');
const {
	FORBIDDEN_MODIFIER_FIELDS,
	MAX_MODIFIER_COUNT,
	MAX_MODIFIER_REQUESTS,
} = require('./constants');

function validateModifierEntrySchema(entrySchema, file) {
	const required = new Set(entrySchema.required);
	const technical = new Set(entrySchema.technical ?? []);
	if (!required.has('Name') || !required.has('Description')) {
		throw generatorSchemaError(
			'INVALID_MODIFIER_ENTRY_SCHEMA',
			`Modifier generator ${file} must declare Name and Description.`,
		);
	}
	if (technical.has('Name') || technical.has('Description')) {
		throw generatorSchemaError(
			'INVALID_MODIFIER_ENTRY_SCHEMA',
			`Modifier generator ${file} must localize Name and Description.`,
		);
	}
	if (entrySchema.required.some(field => (
		FORBIDDEN_MODIFIER_FIELDS.has(field.trim().toLowerCase())
	))) {
		throw generatorSchemaError(
			'MODIFIER_MECHANICAL_FIELD',
			`Modifier generator ${file} declares a mechanical field.`,
		);
	}
}

function validateModifierRequests(requests, location) {
	if (
		!Array.isArray(requests)
		|| requests.length === 0
		|| requests.length > MAX_MODIFIER_REQUESTS
	) {
		throw generatorSchemaError(
			'INVALID_MODIFIER_REQUEST',
			`Generator ${location} must contain 1 to ${MAX_MODIFIER_REQUESTS} modifier requests.`,
		);
	}
	for (const request of requests) {
		assertPlainObject(request, `Generator ${location} has an invalid modifier request.`);
		assertExactKeys(
			request,
			['generator', 'chance', 'count'],
			`Generator ${location} modifier request has invalid properties.`,
		);
		validateTechnicalId(request.generator, `modifier generator in ${location}`);
		if (
			!Number.isFinite(request.chance)
			|| request.chance < 0
			|| request.chance > 1
		) {
			throw generatorSchemaError(
				'INVALID_MODIFIER_CHANCE',
				`Generator ${location} has an invalid modifier chance.`,
			);
		}
		assertPlainObject(request.count, `Generator ${location} has an invalid modifier count.`);
		assertExactKeys(
			request.count,
			['min', 'max'],
			`Generator ${location} modifier count has invalid properties.`,
		);
		if (
			!Number.isInteger(request.count.min)
			|| !Number.isInteger(request.count.max)
			|| request.count.min < 0
			|| request.count.max < request.count.min
			|| request.count.max > MAX_MODIFIER_COUNT
		) {
			throw generatorSchemaError(
				'INVALID_MODIFIER_COUNT',
				`Generator ${location} has invalid modifier count bounds.`,
			);
		}
	}
}

function validateTechnicalIdList(ids, file, property) {
	if (!Array.isArray(ids) || ids.length === 0 || new Set(ids).size !== ids.length) {
		throw generatorSchemaError(
			'INVALID_MODIFIER_COMPATIBILITY',
			`Generator ${file} has an invalid ${property} list.`,
		);
	}
	for (const id of ids) {
		validateTechnicalId(id, `${property} value in ${file}`);
	}
}

function validateRelationshipModifierRequests(generator, requests, catalog) {
	for (const request of requests ?? []) {
		const modifier = catalog.get(request.generator);
		if (!modifier || modifier.kind !== 'modifier') {
			throw generatorSchemaError(
				'GENERATOR_REFERENCE_MISSING',
				`Generator ${generator.id} requests an unknown modifier generator.`,
			);
		}
		if (!modifier.appliesTo.includes(generator.id)) {
			throw generatorSchemaError(
				'GENERATOR_MODIFIER_INCOMPATIBLE',
				`Generator ${generator.id} requests an incompatible modifier.`,
			);
		}
		if (request.count.max > modifier.entries.length) {
			throw generatorSchemaError(
				'GENERATOR_MODIFIER_COUNT_UNAVAILABLE',
				`Generator ${generator.id} requests too many unique modifiers.`,
			);
		}
	}
}

module.exports = {
	validateModifierEntrySchema,
	validateModifierRequests,
	validateRelationshipModifierRequests,
	validateTechnicalIdList,
};

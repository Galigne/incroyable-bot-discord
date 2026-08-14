const {
	generatorSchemaError,
	normalizeDisplayName,
} = require('./assertions');
const {
	validateCreatureGenerationRelationships,
} = require('./creatureRelationshipValidation');
const {
	validateModifierRelationships,
} = require('./modifierMapValidation');
const {
	extractInlineReferences,
	parseInlineReference,
} = require('./referenceValidation');

function validateGeneratorRelationships(catalog) {
	if (!(catalog instanceof Map)) {
		throw new TypeError('Generator relationship validation requires a catalog map.');
	}
	const modifierGraph = new Map();
	validatePublicGeneratorNames(catalog);
	for (const generator of catalog.values()) {
		validateInlineRelationships(generator, catalog);
		validateStructuralRoutes(generator, catalog);
		validateModifierRelationships(generator, catalog);
		modifierGraph.set(generator.id, new Set(Object.keys(generator.modifiers ?? {})));
		for (const entry of generator.entries) {
			if (entry.generation) {
				validateCreatureGenerationRelationships(
					generator,
					entry,
					catalog,
					validateReferenceRelationship,
				);
			}
		}
	}
	validateModifierCycles(modifierGraph);
	return true;
}

function validateStructuralRoutes(generator, catalog) {
	for (const entry of generator.entries) {
		if (entry.generator !== undefined && !catalog.has(entry.generator)) {
			throw generatorSchemaError(
				'GENERATOR_REFERENCE_MISSING',
				`Generator ${generator.id}:${entry.id} has an unknown structural route.`,
			);
		}
	}
}

function validateModifierCycles(graph) {
	const visiting = new Set();
	const visited = new Set();
	const visit = generatorId => {
		if (visiting.has(generatorId)) {
			throw generatorSchemaError(
				'GENERATOR_MODIFIER_CYCLE',
				'A generator modifier relationship contains a recursive cycle.',
			);
		}
		if (visited.has(generatorId)) {
			return;
		}
		visiting.add(generatorId);
		for (const sourceId of graph.get(generatorId) ?? []) {
			visit(sourceId);
		}
		visiting.delete(generatorId);
		visited.add(generatorId);
	};
	for (const generatorId of graph.keys()) {
		visit(generatorId);
	}
}

function validateInlineRelationships(generator, catalog) {
	const visit = (value, location) => {
		if (typeof value === 'string') {
			for (const expression of extractInlineReferences(value, location)) {
				const reference = parseInlineReference(expression, location);
				const source = catalog.get(reference.generator);
				if (!source) {
					throw generatorSchemaError(
						'GENERATOR_REFERENCE_MISSING',
						`Generator ${generator.id} references an unknown inline generator.`,
					);
				}
				const entry = reference.entry
					? source.entries.find(candidate => candidate.id === reference.entry)
					: undefined;
				if (reference.entry && !entry) {
					throw generatorSchemaError(
						'GENERATOR_ENTRY_NOT_FOUND',
						`Generator ${generator.id} references an unknown inline entry.`,
					);
				}
				if (
					reference.field
					&& reference.field !== 'name'
					&& !source.entrySchema.required.includes(reference.field)
				) {
					throw generatorSchemaError(
						'INVALID_GENERATOR_SELECTOR',
						`Generator ${generator.id} references an unknown inline field.`,
					);
				}
			}
			return;
		}
		if (Array.isArray(value)) {
			value.forEach((nestedValue, index) => visit(nestedValue, `${location}.${index}`));
			return;
		}
		if (value && typeof value === 'object') {
			for (const [key, nestedValue] of Object.entries(value)) {
				visit(nestedValue, `${location}.${key}`);
			}
		}
	};
	visit(generator.name, `${generator.id}.name`);
	visit(generator.description, `${generator.id}.description`);
	for (const [index, entry] of generator.entries.entries()) {
		visit(entry, `${generator.id}.entries.${index}`);
	}
}

function validateReferenceRelationship(reference, catalog, ownerId) {
	const sourceIds = typeof reference.generator === 'string'
		? [reference.generator]
		: reference.generator.oneOf.map(source => source.id);
	for (const sourceId of sourceIds) {
		const source = catalog.get(sourceId);
		if (!source) {
			throw generatorSchemaError(
				'GENERATOR_REFERENCE_MISSING',
				`Generator ${ownerId} references an unknown generator.`,
			);
		}
		if (reference.entry && !source.entries.some(entry => entry.id === reference.entry)) {
			throw generatorSchemaError(
				'GENERATOR_ENTRY_NOT_FOUND',
				`Generator ${ownerId} references an unknown fixed entry.`,
			);
		}
		validateSelectorForGenerator(reference.select, source, ownerId);
	}
	return sourceIds.map(sourceId => catalog.get(sourceId));
}

function validateSelectorForGenerator(selector, source, ownerId) {
	if (selector === 'display') {
		return;
	}
	if (selector === 'value' && source.entrySchema.required.length === 0) {
		return;
	}
	if (selector === 'fields' && source.entrySchema.required.length > 0) {
		return;
	}
	if (selector.startsWith('fields.')) {
		const field = selector.slice('fields.'.length);
		if (field === 'name' || source.entrySchema.required.includes(field)) {
			return;
		}
	}
	throw generatorSchemaError(
		'INVALID_GENERATOR_SELECTOR',
		`Generator ${ownerId} uses a selector unsupported by ${source.id}.`,
	);
}

function validatePublicGeneratorNames(catalog) {
	const names = new Map();
	const publicGenerators = [...catalog.values()].filter(generator => (
		generator.visibility === 'public'
	));
	const stableIds = new Map(publicGenerators.map(generator => [
		normalizeDisplayName(generator.id),
		generator.id,
	]));
	for (const generator of publicGenerators) {
		const normalizedName = normalizeDisplayName(generator.name);
		const existingId = names.get(normalizedName);
		if (existingId) {
			throw generatorSchemaError(
				'DUPLICATE_PUBLIC_GENERATOR_NAME',
				`Public generators ${existingId} and ${generator.id} have ambiguous names.`,
			);
		}
		names.set(normalizedName, generator.id);
		const conflictingId = stableIds.get(normalizedName);
		if (conflictingId && conflictingId !== generator.id) {
			throw generatorSchemaError(
				'AMBIGUOUS_PUBLIC_GENERATOR_ALIAS',
				`Public generator ${generator.id} has an alias that conflicts with stable ID ${conflictingId}.`,
			);
		}
	}
}

module.exports = { validateGeneratorRelationships };

const {
	generatorSchemaError,
	normalizeDisplayName,
} = require('./assertions');
const {
	validateRoutedArchetypeRelationships,
} = require('./routedArchetypeValidation');
const {
	validateModifierRelationships,
} = require('./modifierMapValidation');
const {
	extractInlineReferences,
	parseInlineReference,
} = require('./referenceValidation');
const {
	analyzeGeneratorTraversalPath,
} = require('../generatorTraversal');

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
	}
	validateRoutedArchetypeRelationships(catalog, validateReferenceRelationship);
	validateModifierCycles(modifierGraph);
	return true;
}

function validateStructuralRoutes(generator, catalog) {
	for (const entry of generator.entries) {
		if (entry.generator === undefined) {
			continue;
		}
		const target = catalog.get(entry.generator);
		if (!target) {
			throw generatorSchemaError(
				'GENERATOR_REFERENCE_MISSING',
				`Generator ${generator.id}:${entry.id} has an unknown structural route.`,
			);
		}
		if (target.visibility !== 'internal') {
			throw generatorSchemaError(
				'INVALID_GENERATOR_ROUTE_TARGET',
				`Generator ${generator.id}:${entry.id} must route to an internal generator.`,
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
				validateCanonicalReferenceRelationship(
					expression,
					catalog,
					generator.id,
					location,
				);
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
	if (typeof reference === 'string') {
		return validateCanonicalReferenceRelationship(
			reference,
			catalog,
			ownerId,
			`${ownerId} generation reference`,
		);
	}
	if (!reference?.generator?.oneOf) {
		throw generatorSchemaError(
			'INVALID_GENERATOR_REFERENCE',
			`Generator ${ownerId} must use a canonical path string.`,
		);
	}
	const sourceIds = reference.generator.oneOf.map(source => source.id);
	for (const sourceId of sourceIds) {
		const source = catalog.get(sourceId);
		if (!source) {
			throw generatorSchemaError(
				'GENERATOR_REFERENCE_MISSING',
				`Generator ${ownerId} references an unknown generator.`,
			);
		}
		validateSelectorForGenerator(reference.select, source, ownerId);
	}
	return {
		field: reference.select.startsWith('fields.')
			? reference.select.slice('fields.'.length)
			: undefined,
		selector: reference.select,
		sources: sourceIds.map(sourceId => catalog.get(sourceId)),
	};
}

function validateCanonicalReferenceRelationship(
	referencePath,
	catalog,
	ownerId,
	location,
) {
	const parsed = parseInlineReference(referencePath, location);
	if (!catalog.has(parsed.rootId)) {
		throw generatorSchemaError(
			'GENERATOR_REFERENCE_MISSING',
			`Generator ${ownerId} references an unknown generator.`,
		);
	}
	const analysis = analyzeGeneratorTraversalPath(
		referencePath,
		'en',
		{
			allowAliases: false,
			getGenerator: id => catalog.get(id),
			implicitRouterSelections: false,
			listGenerators: () => [...catalog.values()],
			rootVisibility: 'all',
		},
	);
	if (!analysis) {
		classifyInvalidCanonicalPath(parsed, catalog, ownerId);
		if (parsed.field !== undefined) {
			const withoutField = referencePath.slice(0, referencePath.lastIndexOf('.'));
			const sourceAnalysis = analyzeGeneratorTraversalPath(
				withoutField,
				'en',
				{
					allowAliases: false,
					getGenerator: id => catalog.get(id),
					implicitRouterSelections: false,
					listGenerators: () => [...catalog.values()],
					rootVisibility: 'all',
				},
			);
			if (sourceAnalysis) {
				throw generatorSchemaError(
					'INVALID_GENERATOR_SELECTOR',
					`Generator ${ownerId} references an unknown field.`,
				);
			}
		}
		throw generatorSchemaError(
			'INVALID_GENERATOR_REFERENCE_PATH',
			`Generator ${ownerId} has an invalid reference path.`,
		);
	}
	return {
		field: analysis.traversal.field,
		selector: analysis.traversal.field === undefined ? 'content' : 'field',
		sources: analysis.contexts.map(context => context.generator),
	};
}

function classifyInvalidCanonicalPath(parsed, catalog, ownerId) {
	let contexts = [{ generator: catalog.get(parsed.rootId), entry: undefined }];
	for (const operation of parsed.operations) {
		if (operation.type === 'selection') {
			if (contexts.some(context => context.entry !== undefined)) {
				return;
			}
			const entries = contexts.map(context => (
				context.generator.entries.find(entry => entry.id === operation.entryId)
			));
			if (entries.some(entry => !entry)) {
				throw generatorSchemaError(
					'GENERATOR_ENTRY_NOT_FOUND',
					`Generator ${ownerId} references an unknown fixed entry.`,
				);
			}
			contexts = contexts.map((context, index) => ({
				generator: context.generator,
				entry: entries[index],
			}));
			continue;
		}

		const entries = contexts.flatMap(context => (
			context.entry ? [context.entry] : context.generator.entries
		));
		if (entries.some(entry => !entry.generator)) {
			return;
		}
		const generators = entries.map(entry => catalog.get(entry.generator));
		if (generators.some(generator => !generator)) {
			throw generatorSchemaError(
				'GENERATOR_REFERENCE_MISSING',
				`Generator ${ownerId} references an unknown generator.`,
			);
		}
		contexts = generators.map(generator => ({ generator, entry: undefined }));
	}
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

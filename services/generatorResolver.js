const generatorCatalog = require('./generatorCatalog');
const { generatorResolutionError } = require('./generatorResolutionError');
const { createReferenceResolver } = require('./referenceResolver');
const {
	parseWrappedInlineReference,
} = require('./generatorSchema/referenceValidation');
const {
	analyzeGeneratorTraversalPath,
} = require('./generatorTraversal');
const {
	isGeneratorRouter,
} = require('./generatorSchema/routerValidation');
const { selectWeightedEntry } = require('./weightedSelector');
const { readNormalizedRandom } = require('./random');

const DEFAULT_MAX_DEPTH = 5;
const MAX_ALLOWED_DEPTH = 5;

function createGeneratorResolver({
	getGenerator = generatorCatalog.getGenerator,
	listGenerators = generatorCatalog.listGenerators,
} = {}) {
	const referenceResolver = createReferenceResolver({
		getGenerator,
		resolveSelection,
	});

	function generate(traversalPath, locale = 'en', options = {}) {
		validateOptions(locale, options);
		const analysis = analyzeGeneratorTraversalPath(
			traversalPath,
			locale,
			{ getGenerator, listGenerators },
		);
		if (!analysis) {
			return null;
		}
		const random = options.random ?? Math.random;
		const state = createState(locale, options, random);
		return resolveAnalyzedTraversal(
			analysis,
			state,
			'root.traversal',
			{ indexedPaths: true },
		);
	}

	function resolveReference(reference, locale = 'en', options = {}) {
		validateOptions(locale, options);
		const random = options.random ?? Math.random;
		const state = createState(locale, options, random);
		if (typeof reference === 'string') {
			return resolveCanonicalPath(
				reference,
				state,
				options.path ?? 'root.reference',
			);
		}
		if (!reference?.generator?.oneOf) {
			throw new TypeError(
				'Ordinary generator references must use a canonical path string.',
			);
		}
		return referenceResolver.resolveReference(
			reference,
			locale,
			state,
			options.path ?? 'root.reference',
		);
	}

	function resolveInlineReference(expression, locale = 'en', options = {}) {
		validateOptions(locale, options);
		const random = options.random ?? Math.random;
		const state = options.state ?? createState(locale, options, random);
		return resolveInlineReferenceInState(expression, state, options.path ?? 'root.inline');
	}

	function resolveInlineString(value, locale = 'en', options = {}) {
		if (typeof value !== 'string') {
			throw new TypeError('Generator inline text must be a string.');
		}
		validateOptions(locale, options);
		const random = options.random ?? Math.random;
		const state = options.state ?? createState(locale, options, random);
		return resolveTemplateString(value, state, options.path ?? 'root.inline');
	}

	function resolveInlineReferenceInState(expression, state, path) {
		const parsed = parseWrappedInlineReference(expression, path);
		const resolved = resolveCanonicalPath(parsed.path, state, path);
		const field = parsed.field;
		return {
			value: field === undefined
				? resolved.display
				: resolved.displayFields[field],
			fields: resolved.fields,
			displayFields: resolved.displayFields,
			template: field === undefined
				? resolved.displayTemplate
				: resolved.displayFieldTemplates[field],
			provenance: resolved.provenance,
			modifiers: resolved.modifiers,
		};
	}

	function resolveCanonicalPath(referencePath, state, path) {
		const analysis = analyzeGeneratorTraversalPath(
			referencePath,
			state.locale,
			{
				allowAliases: false,
				getGenerator,
				implicitRouterSelections: false,
				listGenerators,
				rootVisibility: 'all',
			},
		);
		if (!analysis) {
			throw generatorResolutionError(
				'INVALID_GENERATOR_REFERENCE_PATH',
				'The generator reference path is invalid.',
			);
		}
		return resolveAnalyzedTraversal(analysis, state, path);
	}

	function resolveAnalyzedTraversal(analysis, state, path, options = {}) {
		const { traversal } = analysis;
		let generator = getGenerator(traversal.rootId, state.locale);
		const routeProvenance = [];
		const initialDepth = state.activeSelections.length;
		try {
			for (const [index, step] of traversal.steps.entries()) {
				const entry = selectTraversalEntry(generator, step.entryId, state);
				if (!entry?.generator) {
					return null;
				}
				pushActiveSelection(state, generator, entry);
				routeProvenance.push(createEntryProvenance(
					generator,
					entry,
					step.entryId === undefined ? 'random' : 'fixed',
					options.indexedPaths
						? `${path}.${index}`
						: `${path}.routes.${index}`,
				));
				generator = getGenerator(entry.generator, state.locale);
				if (!generator) {
					return null;
				}
			}
			const entry = selectTraversalEntry(
				generator,
				traversal.entryId,
				state,
			);
			if (!entry) {
				return null;
			}
			const resolved = resolveSelection(
				generator,
				entry,
				traversal.entryId === undefined ? 'random' : 'fixed',
				state,
				options.indexedPaths
					? `${path}.${traversal.steps.length}`
					: path,
				traversal.field,
				{
					applyModifiers: traversal.field === undefined
						&& !isGeneratorRouter(generator),
				},
			);
			resolved.provenance = [...routeProvenance, ...resolved.provenance];
			return traversal.field === undefined
				? createCompletedResult(generator, entry, resolved)
				: createCompletedFieldResult(
					generator,
					entry,
					resolved,
					traversal.field,
				);
		}
		finally {
			state.activeSelections.length = initialDepth;
		}
	}

	function resolveSelection(
		generator,
		entry,
		selection,
		state,
		path,
		requestedField,
		options = {},
	) {
		const selectionKey = `${generator.id}:${entry.id}`;
		if (state.activeSelections.includes(selectionKey)) {
			throw generatorResolutionError(
				'GENERATOR_REFERENCE_CYCLE',
				'A generator reference cycle was detected.',
			);
		}
		if (state.activeSelections.length >= state.maxDepth) {
			throw generatorResolutionError(
				'GENERATOR_MAX_DEPTH_EXCEEDED',
				'The generator reference nesting limit was exceeded.',
			);
		}

		state.activeSelections.push(selectionKey);
		try {
			const payload = resolvePayload(generator, entry, state, path, requestedField);
			const ownModifiers = options.applyModifiers === false
				? []
				: resolveGeneratorModifiers(generator, state, `${path}.modifiers`);
			return {
				...payload,
				provenance: [
					{
						type: 'entry',
						selection,
						generatorId: generator.id,
						entryId: entry.id,
						path,
					},
					...payload.provenance,
				],
				modifiers: [...payload.modifiers, ...ownModifiers],
			};
		}
		finally {
			state.activeSelections.pop();
		}
	}

	function resolveGeneratorModifiers(generator, state, path) {
		return Object.entries(generator.modifiers ?? {}).flatMap((
			[modifierId, percentage],
			index,
		) => {
			if (readNormalizedRandom(state.random) >= percentage / 100) {
				return [];
			}
			const modifierGenerator = getGenerator(modifierId, state.locale);
			if (!modifierGenerator) {
				throw generatorResolutionError(
					'GENERATOR_MODIFIER_MISSING',
					'The requested modifier generator is unavailable.',
				);
			}
			const entry = selectWeightedEntry(modifierGenerator.entries, state.random);
			const modifierPath = `${path}.${index}.${modifierId}`;
			const resolved = resolveSelection(
				modifierGenerator,
				entry,
				'random',
				state,
				modifierPath,
			);
			return [createCompletedResult(modifierGenerator, entry, resolved)];
		});
	}

	function resolvePayload(generator, entry, state, path, requestedField) {
		if (generator.entrySchema.required.length === 0 && requestedField === undefined) {
			const resolved = resolveTemplateString(entry.name, state, `${path}.name`);
			return {
				outputType: 'value',
				value: resolved.value,
				display: resolved.value,
				displayTemplate: resolved.template,
				provenance: resolved.provenance,
				modifiers: resolved.modifiers,
			};
		}

		const fields = { name: entry.name, ...(entry.fields ?? {}) };
		const fieldOrder = ['name', ...generator.entrySchema.required];
		const displayFields = {};
		const displayFieldTemplates = {};
		let provenance = [];
		let modifiers = [];
		if (requestedField === undefined) {
			for (const field of fieldOrder) {
				const resolved = resolveTemplateString(
					String(fields[field]),
					state,
					field === 'name' ? `${path}.name` : `${path}.fields.${field}`,
				);
				displayFields[field] = resolved.value;
				displayFieldTemplates[field] = resolved.template;
				provenance = [...provenance, ...resolved.provenance];
				modifiers = [...modifiers, ...resolved.modifiers];
			}
		}

		let selectedField;
		let selectedDisplayTemplate;
		if (requestedField !== undefined) {
			if (!Object.hasOwn(fields, requestedField)) {
				throw generatorResolutionError(
					'INVALID_GENERATOR_SELECTOR',
					'The generator selector is not valid for the selected entry.',
				);
			}
			if (typeof fields[requestedField] === 'string') {
				const resolved = resolveTemplateString(
					fields[requestedField],
					state,
					requestedField === 'name'
						? `${path}.name`
						: `${path}.fields.${requestedField}`,
				);
				selectedField = resolved.value;
				selectedDisplayTemplate = resolved.template;
				provenance = [...provenance, ...resolved.provenance];
				modifiers = [...modifiers, ...resolved.modifiers];
			}
			else {
				selectedField = fields[requestedField];
				selectedDisplayTemplate = createStaticTemplate(selectedField);
			}
		}

		const displayTemplate = joinTemplates(
			fieldOrder
				.map(field => displayFieldTemplates[field]),
			' — ',
		);
		const display = fieldOrder
			.map(field => displayFields[field])
			.join(' — ');
		return {
			outputType: 'fields',
			fields,
			displayFields,
			displayFieldTemplates,
			display,
			displayTemplate,
			selectedField,
			selectedDisplayTemplate,
			provenance,
			modifiers,
		};
	}

	function resolveTemplateString(value, state, path) {
		if (typeof value !== 'string') {
			return {
				value: String(value),
				template: createStaticTemplate(value),
				provenance: [],
				modifiers: [],
			};
		}
		const matcher = /\{\{([^{}]*)\}\}/g;
		let output = '';
		let cursor = 0;
		let referenceIndex = 0;
		const templateParts = [];
		let provenance = [];
		let modifiers = [];
		for (const match of value.matchAll(matcher)) {
			const staticValue = value.slice(cursor, match.index);
			output += staticValue;
			appendTemplateText(templateParts, staticValue);
			const resolved = resolveInlineReferenceInState(
				match[0],
				state,
				`${path}.references.${referenceIndex}`,
			);
			output += formatInlineValue(resolved.value);
			templateParts.push({ type: 'reference', template: resolved.template });
			provenance = [...provenance, ...resolved.provenance];
			modifiers = [...modifiers, ...resolved.modifiers];
			cursor = match.index + match[0].length;
			referenceIndex += 1;
		}
		const trailingValue = value.slice(cursor);
		output += trailingValue;
		appendTemplateText(templateParts, trailingValue);
		return {
			value: output,
			template: { type: 'template', parts: templateParts },
			provenance,
			modifiers,
		};
	}

	return {
		generate,
		resolveInlineReference,
		resolveInlineString,
		resolveReference,
	};

	function createState(locale, options, random) {
		return {
			activeSelections: [],
			excludedEntryIdsByGenerator: normalizeEntryExclusions(
				options.excludedEntryIdsByGenerator,
			),
			locale,
			maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
			random,
		};
	}
}

function formatInlineValue(value) {
	if (['string', 'number', 'boolean'].includes(typeof value)) {
		return String(value);
	}
	throw generatorResolutionError(
		'GENERATOR_INLINE_REFERENCE_INVALID',
		'An inline generator reference resolved to an unsupported value.',
	);
}

function createCompletedResult(generator, entry, resolved) {
	const result = {
		generatorId: generator.id,
		generatorName: generator.name,
		entryId: entry.id,
		outputType: resolved.outputType,
		display: resolved.display,
		displayTemplate: resolved.displayTemplate,
		provenance: resolved.provenance,
		modifiers: resolved.modifiers,
	};
	if (resolved.outputType === 'fields') {
		result.fields = resolved.fields;
		result.displayFields = resolved.displayFields;
		result.displayFieldTemplates = resolved.displayFieldTemplates;
	}
	else {
		result.value = resolved.value;
		result.valueTemplate = resolved.displayTemplate;
	}
	return result;
}

function createCompletedFieldResult(generator, entry, resolved, field) {
	return {
		generatorId: generator.id,
		generatorName: generator.name,
		entryId: entry.id,
		outputType: 'fields',
		display: String(resolved.selectedField),
		displayTemplate: resolved.selectedDisplayTemplate,
		fields: { [field]: resolved.selectedField },
		displayFields: { [field]: resolved.selectedField },
		displayFieldTemplates: {
			[field]: resolved.selectedDisplayTemplate,
		},
		provenance: resolved.provenance,
		modifiers: resolved.modifiers,
	};
}

function selectTraversalEntry(generator, entryId, state) {
	if (entryId !== undefined) {
		return generator.entries.find(entry => entry.id === entryId);
	}
	const exclusions = state.excludedEntryIdsByGenerator?.[generator.id];
	const eligibleEntries = exclusions?.size
		? generator.entries.filter(entry => !exclusions.has(entry.id))
		: generator.entries;
	if (eligibleEntries.length === 0) {
		throw generatorResolutionError(
			'GENERATOR_NO_ELIGIBLE_ENTRY',
			'The generator has no eligible random entry.',
		);
	}
	return selectWeightedEntry(eligibleEntries, state.random);
}

function normalizeEntryExclusions(exclusions = {}) {
	return Object.fromEntries(Object.entries(exclusions).map((
		[generatorId, entryIds],
	) => [generatorId, new Set(entryIds)]));
}

function pushActiveSelection(state, generator, entry) {
	const selectionKey = `${generator.id}:${entry.id}`;
	if (state.activeSelections.includes(selectionKey)) {
		throw generatorResolutionError(
			'GENERATOR_REFERENCE_CYCLE',
			'A generator reference cycle was detected.',
		);
	}
	if (state.activeSelections.length >= state.maxDepth) {
		throw generatorResolutionError(
			'GENERATOR_MAX_DEPTH_EXCEEDED',
			'The generator reference nesting limit was exceeded.',
		);
	}
	state.activeSelections.push(selectionKey);
}

function createEntryProvenance(generator, entry, selection, path) {
	return {
		type: 'entry',
		selection,
		generatorId: generator.id,
		entryId: entry.id,
		path,
	};
}

function createStaticTemplate(value) {
	return {
		type: 'template',
		parts: [{ type: 'text', value: String(value) }],
	};
}

function appendTemplateText(parts, value) {
	if (value) {
		parts.push({ type: 'text', value });
	}
}

function joinTemplates(templates, separator) {
	const parts = [];
	for (const [index, template] of templates.entries()) {
		if (index > 0) {
			appendTemplateText(parts, separator);
		}
		parts.push(...(template?.parts ?? []));
	}
	return { type: 'template', parts };
}

function validateOptions(locale, options) {
	if (typeof locale !== 'string') {
		throw new TypeError('Generator locale must be provided before options.');
	}
	if (!options || typeof options !== 'object' || Array.isArray(options)) {
		throw new TypeError('Generator options must be an object.');
	}
	if (options.random !== undefined && typeof options.random !== 'function') {
		throw new TypeError('Generator random option must be a function.');
	}
	if (
		options.maxDepth !== undefined
		&& (
			!Number.isInteger(options.maxDepth)
			|| options.maxDepth < 1
			|| options.maxDepth > MAX_ALLOWED_DEPTH
		)
	) {
		throw new TypeError(`Generator maxDepth must be an integer from 1 to ${MAX_ALLOWED_DEPTH}.`);
	}
	if (
		options.path !== undefined
		&& (typeof options.path !== 'string' || !options.path.trim())
	) {
		throw new TypeError('Generator reference path must be a non-empty string.');
	}
	if (options.excludedEntryIdsByGenerator !== undefined) {
		const exclusions = options.excludedEntryIdsByGenerator;
		if (
			!exclusions
			|| typeof exclusions !== 'object'
			|| Array.isArray(exclusions)
			|| Object.entries(exclusions).some(([generatorId, entryIds]) => (
				!generatorId
				|| !Array.isArray(entryIds)
				|| entryIds.some(entryId => (
					typeof entryId !== 'string' || !entryId.trim()
				))
			))
		) {
			throw new TypeError(
				'Generator entry exclusions must map generator IDs to entry ID arrays.',
			);
		}
	}
}

function assertGeneratorResolverInterface(resolver) {
	if (
		typeof resolver?.generate !== 'function'
		|| typeof resolver.resolveReference !== 'function'
		|| typeof resolver.resolveInlineReference !== 'function'
		|| typeof resolver.resolveInlineString !== 'function'
	) {
		throw new TypeError(
			'Random generation requires a resolver with reference and inline-reference resolution.',
		);
	}
	return resolver;
}

const defaultResolver = createGeneratorResolver();

module.exports = {
	assertGeneratorResolverInterface,
	createGeneratorResolver,
	generate: defaultResolver.generate,
	resolveInlineReference: defaultResolver.resolveInlineReference,
	resolveInlineString: defaultResolver.resolveInlineString,
	resolveReference: defaultResolver.resolveReference,
};

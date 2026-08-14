const generatorCatalog = require('./generatorCatalog');
const { generatorResolutionError } = require('./generatorResolutionError');
const { createReferenceResolver } = require('./referenceResolver');
const {
	parseWrappedInlineReference,
} = require('./generatorSchema/referenceValidation');
const {
	parseGeneratorTraversalPath,
} = require('./generatorTraversal');
const { selectWeightedEntry } = require('./weightedSelector');

const DEFAULT_MAX_DEPTH = 4;
const MAX_ALLOWED_DEPTH = 4;

function createGeneratorResolver({ getGenerator = generatorCatalog.getGenerator } = {}) {
	const referenceResolver = createReferenceResolver({
		getGenerator,
		resolveSelection,
	});

	function generate(traversalPath, locale = 'en', options = {}) {
		validateOptions(locale, options);
		const traversal = parseGeneratorTraversalPath(traversalPath);
		if (!traversal) {
			return null;
		}
		let generator = getGenerator(traversal.rootId, locale);
		if (!generator || generator.visibility !== 'public') {
			return null;
		}
		const random = options.random ?? Math.random;
		const state = createState(locale, options, random);
		let entryId = traversal.rootEntryId;
		const routeProvenance = [];
		for (const [index, route] of traversal.routes.entries()) {
			const entry = selectTraversalEntry(generator, entryId, random);
			if (!entry?.generator) {
				return null;
			}
			pushActiveSelection(state, generator, entry);
			routeProvenance.push(createEntryProvenance(
				generator,
				entry,
				entryId === undefined ? 'random' : 'fixed',
				`root.traversal.${index}`,
			));
			generator = getGenerator(entry.generator, locale);
			if (!generator) {
				return null;
			}
			entryId = route.entryId;
		}
		if (
			traversal.field !== undefined
			&& (
				generator.entrySchema.type !== 'fields'
				|| !generator.entrySchema.required.includes(traversal.field)
			)
		) {
			return null;
		}
		const entry = selectTraversalEntry(generator, entryId, random);
		if (!entry) {
			return null;
		}
		const resolved = resolveSelection(
			generator,
			entry,
			entryId === undefined ? 'random' : 'fixed',
			state,
			`root.traversal.${traversal.routes.length}`,
			traversal.field,
			{ applyModifiers: traversal.field === undefined },
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

	function resolveReference(reference, locale = 'en', options = {}) {
		validateOptions(locale, options);
		const random = options.random ?? Math.random;
		const state = createState(locale, options, random);
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
		const resolved = referenceResolver.resolveReference(
			{
				generator: parsed.generator,
				...(parsed.entry ? { entry: parsed.entry } : {}),
				select: parsed.field ? `fields.${parsed.field}` : 'display',
			},
			state.locale,
			state,
			path,
		);
		return {
			value: resolved.outputType === 'fields' && !parsed.field
				? resolved.display
				: resolved.value,
			fields: resolved.fields,
			template: resolved.template,
			provenance: resolved.provenance,
			modifiers: resolved.modifiers,
		};
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
			if (readRandom(state.random) >= percentage / 100) {
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
		if (generator.entrySchema.type === 'text') {
			const resolved = resolveTemplateString(entry.value, state, `${path}.value`);
			return {
				outputType: 'value',
				value: resolved.value,
				display: resolved.value,
				displayTemplate: resolved.template,
				provenance: resolved.provenance,
				modifiers: resolved.modifiers,
			};
		}

		const fields = { ...entry.fields };
		const displayFields = {};
		const displayFieldTemplates = {};
		let provenance = [];
		let modifiers = [];
		if (requestedField === undefined) {
			for (const field of generator.entrySchema.required) {
				const resolved = resolveTemplateString(
					String(fields[field]),
					state,
					`${path}.fields.${field}`,
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
					`${path}.fields.${requestedField}`,
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
			generator.entrySchema.required
				.map(field => displayFieldTemplates[field]),
			' — ',
		);
		const display = generator.entrySchema.required
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

function readRandom(random) {
	return Math.max(0, Math.min(0.9999999999999999, random()));
}

function createCompletedResult(generator, entry, resolved) {
	const result = {
		generatorId: generator.id,
		generatorName: generator.name,
		entryId: entry.id,
		outputType: resolved.outputType,
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
		fields: { [field]: resolved.selectedField },
		displayFields: { [field]: resolved.selectedField },
		displayFieldTemplates: {
			[field]: resolved.selectedDisplayTemplate,
		},
		provenance: resolved.provenance,
		modifiers: resolved.modifiers,
	};
}

function selectTraversalEntry(generator, entryId, random) {
	return entryId === undefined
		? selectWeightedEntry(generator.entries, random)
		: generator.entries.find(entry => entry.id === entryId);
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
}

function assertGeneratorResolverInterface(resolver) {
	if (
		typeof resolver?.generate !== 'function'
		|| typeof resolver.resolveReference !== 'function'
		|| typeof resolver.resolveInlineReference !== 'function'
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

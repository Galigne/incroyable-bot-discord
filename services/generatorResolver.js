const generatorCatalog = require('./generatorCatalog');
const { generatorResolutionError } = require('./generatorResolutionError');
const { createReferenceResolver } = require('./referenceResolver');
const { parseInlineReference } = require('./generatorSchema/referenceValidation');
const { selectWeightedEntry } = require('./weightedSelector');

const DEFAULT_MAX_DEPTH = 4;
const MAX_ALLOWED_DEPTH = 4;

function createGeneratorResolver({ getGenerator = generatorCatalog.getGenerator } = {}) {
	const referenceResolver = createReferenceResolver({
		getGenerator,
		resolveSelection,
	});

	function generate(generatorId, locale = 'en', options = {}) {
		validateOptions(locale, options);
		const generator = getGenerator(generatorId, locale);
		if (!generator || generator.visibility !== 'public') {
			return null;
		}
		validateExplicitModifier(generator, options.modifier);
		const random = options.random ?? Math.random;
		const state = createState(locale, options, random);
		const entry = selectWeightedEntry(generator.entries, random);
		const resolved = resolveSelection(
			generator,
			entry,
			'random',
			state,
			'root',
			undefined,
			{ explicitModifier: options.modifier },
		);
		return createCompletedResult(generator, entry, resolved);
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

	function resolveInlineReferenceInState(expression, state, path) {
		const wrapped = typeof expression === 'string'
			? expression.match(/^\s*\{\{([^{}]+)\}\}\s*$/)
			: null;
		const parsed = parseInlineReference(wrapped?.[1] ?? expression, path);
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
			const ownModifiers = resolveGeneratorModifiers(
				generator,
				state,
				`${path}.modifiers`,
				options.explicitModifier,
			);
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

	function resolveGeneratorModifiers(generator, state, path, explicitModifier) {
		return Object.entries(generator.modifiers ?? {}).flatMap((
			[modifierId, percentage],
			index,
		) => {
			const isExplicit = modifierId === explicitModifier;
			if (!isExplicit && readRandom(state.random) >= percentage / 100) {
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
			const resolved = resolveInlineString(entry.value, state, `${path}.value`);
			return {
				outputType: 'value',
				value: resolved.value,
				display: resolved.value,
				provenance: resolved.provenance,
				modifiers: resolved.modifiers,
			};
		}

		const fields = { ...entry.fields };
		const technical = new Set(generator.entrySchema.technical ?? []);
		const displayFields = {};
		let provenance = [];
		let modifiers = [];
		if (requestedField === undefined) {
			for (const field of generator.entrySchema.required) {
				if (technical.has(field)) {
					continue;
				}
				const resolved = resolveInlineString(
					String(fields[field]),
					state,
					`${path}.fields.${field}`,
				);
				displayFields[field] = resolved.value;
				provenance = [...provenance, ...resolved.provenance];
				modifiers = [...modifiers, ...resolved.modifiers];
			}
		}

		let selectedField;
		if (requestedField !== undefined) {
			if (!Object.hasOwn(fields, requestedField)) {
				throw generatorResolutionError(
					'INVALID_GENERATOR_SELECTOR',
					'The generator selector is not valid for the selected entry.',
				);
			}
			if (typeof fields[requestedField] === 'string') {
				const resolved = resolveInlineString(
					fields[requestedField],
					state,
					`${path}.fields.${requestedField}`,
				);
				selectedField = resolved.value;
				provenance = [...provenance, ...resolved.provenance];
				modifiers = [...modifiers, ...resolved.modifiers];
			}
			else {
				selectedField = fields[requestedField];
			}
		}

		const display = generator.entrySchema.required
			.filter(field => !technical.has(field))
			.map(field => displayFields[field])
			.join(' — ');
		return {
			outputType: 'fields',
			fields,
			displayFields,
			display,
			selectedField,
			provenance,
			modifiers,
		};
	}

	function resolveInlineString(value, state, path) {
		if (typeof value !== 'string') {
			return { value: String(value), provenance: [], modifiers: [] };
		}
		const matcher = /\{\{([^{}]*)\}\}/g;
		let output = '';
		let cursor = 0;
		let referenceIndex = 0;
		let provenance = [];
		let modifiers = [];
		for (const match of value.matchAll(matcher)) {
			output += value.slice(cursor, match.index);
			const resolved = resolveInlineReferenceInState(
				match[1],
				state,
				`${path}.references.${referenceIndex}`,
			);
			output += formatInlineValue(resolved.value);
			provenance = [...provenance, ...resolved.provenance];
			modifiers = [...modifiers, ...resolved.modifiers];
			cursor = match.index + match[0].length;
			referenceIndex += 1;
		}
		output += value.slice(cursor);
		return {
			value: output,
			provenance,
			modifiers,
		};
	}

	return {
		generate,
		resolveInlineReference,
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
	}
	else {
		result.value = resolved.value;
	}
	return result;
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
		options.modifier !== undefined
		&& (
			typeof options.modifier !== 'string'
			|| !options.modifier.trim()
		)
	) {
		throw new TypeError('Generator modifier option must be a non-empty string.');
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

function validateExplicitModifier(generator, modifierId) {
	if (modifierId === undefined || Object.hasOwn(generator.modifiers ?? {}, modifierId)) {
		return;
	}
	throw generatorResolutionError(
		'GENERATOR_MODIFIER_INVALID',
		'The selected modifier is not configured for this generator.',
	);
}

const defaultResolver = createGeneratorResolver();

module.exports = {
	createGeneratorResolver,
	generate: defaultResolver.generate,
	resolveInlineReference: defaultResolver.resolveInlineReference,
	resolveReference: defaultResolver.resolveReference,
};

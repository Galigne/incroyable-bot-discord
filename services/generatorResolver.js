const generatorCatalog = require('./generatorCatalog');
const { generatorResolutionError } = require('./generatorResolutionError');
const { createModifierResolver } = require('./modifierResolver');
const { createReferenceResolver } = require('./referenceResolver');
const { selectWeightedEntry } = require('./weightedSelector');

const DEFAULT_MAX_DEPTH = 8;
const MAX_ALLOWED_DEPTH = 32;

function createGeneratorResolver({ getGenerator = generatorCatalog.getGenerator } = {}) {
	const modifierResolver = createModifierResolver({ getGenerator });
	const referenceResolver = createReferenceResolver({
		getGenerator,
		resolveSelection,
	});

	function generate(generatorId, locale = 'en', options = {}) {
		validateOptions(locale, options);
		const generator = getGenerator(generatorId, locale);
		if (!generator || generator.visibility !== 'public' || generator.kind === 'modifier') {
			return null;
		}
		const random = options.random ?? Math.random;
		const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
		const entry = selectWeightedEntry(generator.entries, random);
		const state = {
			activeSelections: [],
			locale,
			maxDepth,
			random,
		};
		const resolved = resolveSelection(generator, entry, 'random', state, 'root');
		return createCompletedResult(generator, entry, resolved);
	}

	function resolveReference(reference, locale = 'en', options = {}) {
		validateOptions(locale, options);
		const state = {
			activeSelections: [],
			locale,
			maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
			random: options.random ?? Math.random,
		};
		return referenceResolver.resolveReference(
			reference,
			locale,
			state,
			options.path ?? 'root.reference',
		);
	}

	function resolveSelection(generator, entry, selection, state, path) {
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
			const payload = resolvePayload(generator, entry, state, path);
			const ownModifiers = modifierResolver.resolveModifierRequests(
				[...(generator.modifiers ?? []), ...(entry.modifiers ?? [])],
				generator.id,
				state.locale,
				{ random: state.random, path: `${path}.modifiers` },
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

	function resolvePayload(generator, entry, state, path) {
		if (generator.entrySchema.type === 'text') {
			return {
				outputType: 'value',
				value: entry.value,
				display: entry.value,
				provenance: [],
				modifiers: [],
			};
		}
		if (generator.entrySchema.type === 'fields') {
			const fields = { ...entry.fields };
			return {
				outputType: 'fields',
				fields,
				display: getFieldsDisplay(generator, fields),
				provenance: [],
				modifiers: [],
			};
		}
		return resolveTemplate(entry, state.locale, state, path);
	}

	function resolveTemplate(entry, locale, state, path) {
		let templateOutput = entry.template;
		const provenance = [];
		const modifiers = [];
		for (const [name, reference] of Object.entries(entry.references)) {
			const referencePath = `${path}.references.${name}`;
			const resolved = referenceResolver.resolveReference(
				reference,
				locale,
				state,
				referencePath,
			);
			const markerValue = formatTemplateReferenceValue(resolved.value);
			templateOutput = templateOutput
				.split(`{{${name}}}`)
				.join(markerValue);
			provenance.push(...resolved.provenance);
			modifiers.push(...resolved.modifiers);
		}
		return {
			outputType: 'template',
			templateOutput,
			display: templateOutput,
			provenance,
			modifiers,
		};
	}

	return {
		generate,
		resolveReference,
	};
}

function formatTemplateReferenceValue(value) {
	if (['string', 'number', 'boolean'].includes(typeof value)) {
		return String(value);
	}
	if (value && typeof value === 'object' && !Array.isArray(value)) {
		const fieldValues = Object.values(value);
		if (fieldValues.every(field => (
			['string', 'number', 'boolean'].includes(typeof field)
		))) {
			return fieldValues.map(String).join(' — ');
		}
	}
	throw generatorResolutionError(
		'GENERATOR_TEMPLATE_REFERENCE_INVALID',
		'A template marker resolved to an unsupported value.',
	);
}

function getFieldsDisplay(generator, fields) {
	if (Object.hasOwn(fields, 'Name')) {
		return String(fields.Name);
	}
	const technical = new Set(generator.entrySchema.technical ?? []);
	const displayField = generator.entrySchema.required.find(field => !technical.has(field))
		?? generator.entrySchema.required[0];
	return String(fields[displayField]);
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
	}
	else if (resolved.outputType === 'template') {
		result.templateOutput = resolved.templateOutput;
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

const defaultResolver = createGeneratorResolver();

module.exports = {
	createGeneratorResolver,
	generate: defaultResolver.generate,
	resolveReference: defaultResolver.resolveReference,
};

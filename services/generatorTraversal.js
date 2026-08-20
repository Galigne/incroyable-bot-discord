const {
	createGeneratorTraversalAlias,
	normalizeDisplayName,
} = require('./generatorSchema/assertions');
const {
	GENERATOR_ID_PATTERN,
} = require('./generatorSchema/constants');
const {
	isGeneratorRouter,
} = require('./generatorSchema/routerValidation');

const TRAVERSAL_ALIAS_PATTERN = /^[\p{L}\p{M}\p{N}]+(?:_[\p{L}\p{M}\p{N}]+)*$/u;

function parseGeneratorTraversalPath(value, options = {}) {
	if (typeof value !== 'string' || !value || value !== value.trim()) {
		return null;
	}
	const segments = value.split('.');
	if (segments.some(segment => !segment)) {
		return null;
	}
	const root = parseSelectionSegment(segments[0], options);
	if (!root || root.id === 'generator') {
		return null;
	}
	const traversal = {
		rootId: root.id,
		operations: root.entryIds.map(entryId => ({
			entryId,
			type: 'selection',
		})),
		field: undefined,
	};
	for (let index = 1; index < segments.length; index += 1) {
		const segment = segments[index];
		const selection = parseSelectionSegment(segment, options);
		if (selection?.id === 'generator') {
			traversal.operations.push({ type: 'route' });
			traversal.operations.push(...selection.entryIds.map(entryId => ({
				entryId,
				type: 'selection',
			})));
			continue;
		}
		if (
			index !== segments.length - 1
			|| segment.includes(':')
			|| !GENERATOR_ID_PATTERN.test(segment)
			|| segment === 'generator'
		) {
			return null;
		}
		traversal.field = segment;
	}
	return traversal;
}

function parseSelectionSegment(segment, options) {
	const parts = segment.split(':');
	const pattern = options.allowAliases === false
		? GENERATOR_ID_PATTERN
		: TRAVERSAL_ALIAS_PATTERN;
	if (parts.some(part => !pattern.test(part))) {
		return null;
	}
	return {
		id: parts[0],
		entryIds: parts.slice(1),
	};
}

function analyzeGeneratorTraversalPath(
	value,
	locale = 'en',
	options = {},
) {
	const parsedTraversal = parseGeneratorTraversalPath(value, options);
	if (!parsedTraversal) {
		return null;
	}
	const { getGenerator, listGenerators } = getCatalogFunctions(options);
	const root = resolveGeneratorSegment(
		parsedTraversal.rootId,
		locale,
		{
			allowAliases: options.allowAliases !== false,
			getGenerator,
			listGenerators,
			rootVisibility: options.rootVisibility ?? 'public',
		},
	);
	if (!root) {
		return null;
	}
	const traversal = {
		rootId: root.id,
		steps: [],
		entryId: undefined,
		field: parsedTraversal.field,
	};
	let localizedPath = createGeneratorTraversalAlias(root.name);
	let contexts = [{ generator: root, entryId: undefined }];
	let previousSelectionRouted = false;
	let usesRedundantRoute = false;
	const implicitRouterSelections = options.implicitRouterSelections !== false;

	for (const operation of parsedTraversal.operations) {
		if (operation.type === 'route') {
			localizedPath += '.generator';
			if (previousSelectionRouted) {
				usesRedundantRoute = true;
				previousSelectionRouted = false;
				continue;
			}
			const routed = routeContexts(contexts, locale, getGenerator);
			if (!routed) {
				return null;
			}
			traversal.steps.push({ entryId: contexts[0].entryId });
			contexts = routed;
			traversal.entryId = undefined;
			previousSelectionRouted = false;
			continue;
		}

		if (contexts.some(context => context.entryId !== undefined)) {
			return null;
		}
		const selection = resolveCommonEntrySelection(
			contexts,
			operation.entryId,
			options.allowAliases !== false,
		);
		if (!selection.valid) {
			return null;
		}
		localizedPath += `:${getCommonLocalizedEntryAlias(
			contexts,
			selection.entryId,
		) ?? selection.entryId}`;
		const selectedContexts = contexts.map(context => ({
			generator: context.generator,
			entryId: selection.entryId,
		}));
		const routerSelections = selectedContexts.map(context => (
			isGeneratorRouter(context.generator)
		));
		if (routerSelections.some(Boolean) && !routerSelections.every(Boolean)) {
			return null;
		}
		if (implicitRouterSelections && routerSelections.every(Boolean)) {
			const routed = routeContexts(selectedContexts, locale, getGenerator);
			if (!routed) {
				return null;
			}
			traversal.steps.push({ entryId: selection.entryId });
			contexts = routed;
			previousSelectionRouted = true;
		}
		else {
			contexts = selectedContexts;
			traversal.entryId = selection.entryId;
			previousSelectionRouted = false;
		}
	}

	if (
		traversal.field !== undefined
		&& contexts.some(context => (
			traversal.field !== 'name'
			&& !context.generator.entrySchema.required.includes(traversal.field)
		))
	) {
		return null;
	}
	if (traversal.field !== undefined) {
		localizedPath += `.${traversal.field}`;
	}
	return {
		contexts,
		localizedPath,
		traversal,
		usesRedundantRoute,
	};
}

function resolveGeneratorSegment(segment, locale, options) {
	const direct = options.getGenerator(segment, locale);
	if (direct && isAllowedRootVisibility(direct, options.rootVisibility)) {
		return direct;
	}
	if (!options.allowAliases) {
		return undefined;
	}
	const normalizedSegment = normalizeDisplayName(segment);
	const matches = options.listGenerators(locale)
		.filter(generator => isAllowedRootVisibility(
			generator,
			options.rootVisibility,
		))
		.filter(generator => normalizeDisplayName(generator.name) === normalizedSegment);
	return matches.length === 1 ? matches[0] : undefined;
}

function isAllowedRootVisibility(generator, visibility) {
	return visibility === 'all' || generator.visibility === visibility;
}

function resolveEntrySegment(generator, segment, allowAliases) {
	const direct = generator.entries.find(entry => entry.id === segment);
	if (direct) {
		return direct;
	}
	if (!allowAliases) {
		return undefined;
	}
	const normalizedSegment = normalizeDisplayName(segment);
	const matches = generator.entries.filter(entry => (
		normalizeDisplayName(entry.name) === normalizedSegment
	));
	return matches.length === 1 ? matches[0] : undefined;
}

function resolveCommonEntrySelection(contexts, segment, allowAliases) {
	const entries = contexts.map(context => (
		resolveEntrySegment(context.generator, segment, allowAliases)
	));
	if (entries.some(entry => !entry)) {
		return { valid: false, entryId: undefined };
	}
	const entryIds = new Set(entries.map(entry => entry.id));
	return entryIds.size === 1
		? { valid: true, entryId: entries[0].id }
		: { valid: false, entryId: undefined };
}

function routeContexts(contexts, locale, getGenerator) {
	const nextContexts = [];
	for (const context of contexts) {
		const entries = getContextEntries(context);
		if (entries.length === 0 || entries.some(entry => !entry.generator)) {
			return null;
		}
		for (const entry of entries) {
			const generator = getGenerator(entry.generator, locale);
			if (!generator) {
				return null;
			}
			nextContexts.push({ generator, entryId: undefined });
		}
	}
	return deduplicateContexts(nextContexts);
}

function getGeneratorTraversalSuggestions(
	value,
	locale = 'en',
	options = {},
) {
	const input = String(value ?? '').trim();
	const { getGenerator, listGenerators } = getCatalogFunctions(options);
	const delimiterIndex = Math.max(input.lastIndexOf(':'), input.lastIndexOf('.'));
	if (delimiterIndex === -1) {
		return rankActiveSegmentSuggestions(
			listGenerators(locale)
				.filter(generator => generator.visibility === 'public')
				.map(generator => {
					const alias = createGeneratorTraversalAlias(generator.name);
					return {
						kind: 'generator',
						label: generator.name,
						description: generator.description,
						segment: alias,
						value: alias,
					};
				}),
			input,
		);
	}

	const delimiter = input[delimiterIndex];
	const prefix = input.slice(0, delimiterIndex);
	const activeSegment = input.slice(delimiterIndex + 1);
	const analysis = analyzeGeneratorTraversalPath(
		prefix,
		locale,
		{ getGenerator, listGenerators },
	);
	if (!analysis || analysis.usesRedundantRoute) {
		return [];
	}
	const isValid = candidate => {
		const candidateAnalysis = analyzeGeneratorTraversalPath(
			candidate,
			locale,
			{ getGenerator, listGenerators },
		);
		return candidateAnalysis !== null && !candidateAnalysis.usesRedundantRoute;
	};
	const suggestions = delimiter === ':'
		? createEntrySuggestions(
			analysis.localizedPath,
			analysis.contexts,
			isValid,
		)
		: createMemberSuggestions(
			analysis.localizedPath,
			analysis.contexts,
			isValid,
		);
	return rankActiveSegmentSuggestions(suggestions, activeSegment);
}

function createScopedGeneratorTraversalPath(rootId, value) {
	if (!GENERATOR_ID_PATTERN.test(rootId) || typeof value !== 'string') {
		return null;
	}
	const normalized = value.trim();
	if (!normalized || normalized !== value) {
		return null;
	}
	return normalized === 'generator'
		|| normalized.startsWith('generator:')
		|| normalized.startsWith('generator.')
		? `${rootId}.${normalized}`
		: `${rootId}:${normalized}`;
}

function getScopedGeneratorTraversalSuggestions(
	value,
	rootId,
	locale = 'en',
	options = {},
) {
	if (!GENERATOR_ID_PATTERN.test(rootId)) {
		return [];
	}
	const input = String(value ?? '').trim();
	const fullInput = input === 'generator'
		|| input.startsWith('generator:')
		|| input.startsWith('generator.')
		? `${rootId}.${input}`
		: `${rootId}:${input}`;
	const { getGenerator, listGenerators } = getCatalogFunctions(options);
	const analysisOptions = {
		getGenerator,
		listGenerators,
		implicitRouterSelections: true,
	};
	const terminalGeneratorIds = options.terminalGeneratorIds;
	return getGeneratorTraversalSuggestions(
		fullInput,
		locale,
		analysisOptions,
	)
		.filter(suggestion => {
			if (!(terminalGeneratorIds instanceof Set)) {
				return true;
			}
			const analysis = analyzeGeneratorTraversalPath(
				suggestion.value,
				locale,
				analysisOptions,
			);
			return Boolean(
				analysis
				&& analysis.traversal.field === undefined
				&& analysis.contexts.every(context => (
					terminalGeneratorIds.has(context.generator.id)
				)),
			);
		})
		.map(suggestion => ({
			...suggestion,
			value: getRelativeTraversalValue(suggestion.value),
		}));
}

function getRelativeTraversalValue(value) {
	const colonIndex = value.indexOf(':');
	const periodIndex = value.indexOf('.');
	const delimiterIndex = [colonIndex, periodIndex]
		.filter(index => index >= 0)
		.sort((left, right) => left - right)[0];
	return delimiterIndex === undefined ? value : value.slice(delimiterIndex + 1);
}

function getCatalogFunctions(options) {
	if (options.getGenerator && options.listGenerators) {
		return {
			getGenerator: options.getGenerator,
			listGenerators: options.listGenerators,
		};
	}
	const generatorCatalog = require('./generatorCatalog');
	return {
		getGenerator: options.getGenerator ?? generatorCatalog.getGenerator,
		listGenerators: options.listGenerators ?? generatorCatalog.listGenerators,
	};
}

function getContextEntries(context) {
	if (context.entryId === undefined) {
		return context.generator.entries;
	}
	const entry = context.generator.entries.find(candidate => (
		candidate.id === context.entryId
	));
	return entry ? [entry] : [];
}

function deduplicateContexts(contexts) {
	const seen = new Set();
	return contexts.filter(context => {
		const key = `${context.generator.id}:${context.entryId ?? ''}`;
		if (seen.has(key)) {
			return false;
		}
		seen.add(key);
		return true;
	});
}

function getCommonLocalizedEntryAlias(contexts, entryId) {
	const aliases = new Set(contexts.map(context => {
		const entry = context.generator.entries.find(candidate => candidate.id === entryId);
		return entry ? createGeneratorTraversalAlias(entry.name) : undefined;
	}));
	return aliases.size === 1 ? [...aliases][0] : undefined;
}

function createEntrySuggestions(prefix, contexts, isValid) {
	const suggestions = [];
	const seen = new Set();
	for (const context of contexts) {
		if (context.entryId !== undefined) {
			continue;
		}
		for (const entry of context.generator.entries) {
			const alias = createGeneratorTraversalAlias(entry.name);
			const value = `${prefix}:${alias}`;
			if (seen.has(value) || !isValid(value)) {
				continue;
			}
			seen.add(value);
			suggestions.push({
				kind: 'entry',
				label: entry.name,
				description: context.generator.name,
				segment: alias,
				value,
			});
		}
	}
	return suggestions;
}

function createMemberSuggestions(prefix, contexts, isValid) {
	const suggestions = [];
	const seen = new Set();
	for (const context of contexts) {
		for (const field of ['name', ...context.generator.entrySchema.required]) {
			if (
				field === 'name'
				&& context.entryId === undefined
				&& isGeneratorRouter(context.generator)
			) {
				continue;
			}
			addSuggestion(suggestions, seen, isValid, {
				kind: 'field',
				label: field,
				description: context.generator.name,
				segment: field,
				value: `${prefix}.${field}`,
			});
		}
	}
	if (contexts.every(context => (
		context.entryId === undefined && isGeneratorRouter(context.generator)
	))) {
		addSuggestion(suggestions, seen, isValid, {
			kind: 'route',
			label: 'generator',
			description: contexts[0].generator.name,
			segment: 'generator',
			value: `${prefix}.generator`,
		});
	}
	return suggestions;
}

function addSuggestion(suggestions, seen, isValid, suggestion) {
	if (!seen.has(suggestion.value) && isValid(suggestion.value)) {
		seen.add(suggestion.value);
		suggestions.push(suggestion);
	}
}

function rankActiveSegmentSuggestions(suggestions, query) {
	const normalizedQuery = normalizeDisplayName(query);
	return suggestions
		.map((suggestion, index) => ({
			index,
			rank: getMatchRank(
				normalizeDisplayName(suggestion.segment),
				normalizedQuery,
			),
			suggestion,
		}))
		.filter(candidate => candidate.rank !== null)
		.sort((left, right) => left.rank - right.rank || left.index - right.index)
		.map(candidate => candidate.suggestion);
}

function getMatchRank(candidate, query) {
	if (!query || candidate === query) {
		return 0;
	}
	if (candidate.startsWith(query)) {
		return 1;
	}
	return candidate.includes(query) ? 2 : null;
}

module.exports = {
	analyzeGeneratorTraversalPath,
	createScopedGeneratorTraversalPath,
	createGeneratorTraversalAlias,
	getGeneratorTraversalSuggestions,
	getScopedGeneratorTraversalSuggestions,
	parseGeneratorTraversalPath,
};

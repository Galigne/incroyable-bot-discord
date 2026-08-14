const generatorCatalog = require('./generatorCatalog');
const {
	createGeneratorTraversalAlias,
	normalizeDisplayName,
} = require('./generatorSchema/assertions');
const {
	GENERATOR_ID_PATTERN,
} = require('./generatorSchema/constants');

const TRAVERSAL_ALIAS_PATTERN = /^[\p{L}\p{M}\p{N}]+(?:_[\p{L}\p{M}\p{N}]+)*$/u;

function parseGeneratorTraversalPath(value) {
	if (typeof value !== 'string' || !value || value !== value.trim()) {
		return null;
	}
	const segments = value.split('.');
	if (segments.some(segment => !segment)) {
		return null;
	}
	const root = parseSelectionSegment(segments[0]);
	if (!root || root.id === 'generator') {
		return null;
	}
	const traversal = {
		rootId: root.id,
		rootEntryId: root.entryId,
		routes: [],
		field: undefined,
	};
	for (let index = 1; index < segments.length; index += 1) {
		const segment = segments[index];
		const route = parseSelectionSegment(segment);
		if (route?.id === 'generator') {
			traversal.routes.push({ entryId: route.entryId });
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

function parseSelectionSegment(segment) {
	const parts = segment.split(':');
	if (
		parts.length > 2
		|| parts.some(part => !TRAVERSAL_ALIAS_PATTERN.test(part))
	) {
		return null;
	}
	return {
		id: parts[0],
		entryId: parts[1],
	};
}

function analyzeGeneratorTraversalPath(
	value,
	locale = 'en',
	options = {},
) {
	const parsedTraversal = parseGeneratorTraversalPath(value);
	if (!parsedTraversal) {
		return null;
	}
	const getGenerator = options.getGenerator ?? generatorCatalog.getGenerator;
	const listGenerators = options.listGenerators ?? generatorCatalog.listGenerators;
	const root = resolvePublicGeneratorSegment(
		parsedTraversal.rootId,
		locale,
		{ getGenerator, listGenerators },
	);
	if (!root) {
		return null;
	}
	const rootEntry = resolveEntrySegment(root, parsedTraversal.rootEntryId);
	if (parsedTraversal.rootEntryId !== undefined && !rootEntry) {
		return null;
	}
	const traversal = {
		rootId: root.id,
		rootEntryId: rootEntry?.id,
		routes: [],
		field: parsedTraversal.field,
	};
	let localizedPath = createGeneratorTraversalAlias(root.name);
	if (rootEntry) {
		localizedPath += `:${createGeneratorTraversalAlias(rootEntry.name)}`;
	}
	let contexts = [{ generator: root, entryId: traversal.rootEntryId }];
	if (!hasValidContextSelections(contexts)) {
		return null;
	}

	for (const route of parsedTraversal.routes) {
		const nextGenerators = [];
		for (const context of contexts) {
			const entries = getContextEntries(context);
			if (entries.some(entry => !entry.generator)) {
				return null;
			}
			for (const entry of entries) {
				const generator = getGenerator(entry.generator, locale);
				if (!generator) {
					return null;
				}
				nextGenerators.push(generator);
			}
		}
		const selection = resolveCommonEntrySelection(nextGenerators, route.entryId);
		if (!selection.valid) {
			return null;
		}
		contexts = deduplicateContexts(nextGenerators.map(generator => ({
			generator,
			entryId: selection.entryId,
		})));
		if (!hasValidContextSelections(contexts)) {
			return null;
		}
		traversal.routes.push({ entryId: selection.entryId });
		localizedPath += '.generator';
		if (selection.entryId !== undefined) {
			localizedPath += `:${getCommonLocalizedEntryAlias(
				contexts,
				selection.entryId,
			) ?? selection.entryId}`;
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
	return { contexts, localizedPath, traversal };
}

function resolvePublicGeneratorSegment(segment, locale, options) {
	const direct = options.getGenerator(segment, locale);
	if (direct?.visibility === 'public') {
		return direct;
	}
	const normalizedSegment = normalizeDisplayName(segment);
	const matches = options.listGenerators(locale)
		.filter(generator => generator.visibility === 'public')
		.filter(generator => normalizeDisplayName(generator.name) === normalizedSegment);
	return matches.length === 1 ? matches[0] : undefined;
}

function resolveEntrySegment(generator, segment) {
	if (segment === undefined) {
		return undefined;
	}
	const direct = generator.entries.find(entry => entry.id === segment);
	if (direct) {
		return direct;
	}
	const normalizedSegment = normalizeDisplayName(segment);
	const matches = generator.entries.filter(entry => (
		normalizeDisplayName(entry.name) === normalizedSegment
	));
	return matches.length === 1 ? matches[0] : undefined;
}

function resolveCommonEntrySelection(generators, segment) {
	if (segment === undefined) {
		return { valid: true, entryId: undefined };
	}
	const entries = generators.map(generator => resolveEntrySegment(generator, segment));
	if (entries.some(entry => !entry)) {
		return { valid: false, entryId: undefined };
	}
	const entryIds = new Set(entries.map(entry => entry.id));
	return entryIds.size === 1
		? { valid: true, entryId: entries[0].id }
		: { valid: false, entryId: undefined };
}

function hasValidContextSelections(contexts) {
	return contexts.length > 0 && contexts.every(context => (
		getContextEntries(context).length > 0
	));
}

function getGeneratorTraversalSuggestions(
	value,
	locale = 'en',
	options = {},
) {
	const input = String(value ?? '').trim();
	const getGenerator = options.getGenerator ?? generatorCatalog.getGenerator;
	const listGenerators = options.listGenerators ?? generatorCatalog.listGenerators;
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
	if (!analysis) {
		return [];
	}
	const isValid = candidate => analyzeGeneratorTraversalPath(
		candidate,
		locale,
		{ getGenerator, listGenerators },
	) !== null;
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
			addSuggestion(suggestions, seen, isValid, {
				kind: 'field',
				label: field,
				description: context.generator.name,
				segment: field,
				value: `${prefix}.${field}`,
			});
		}
		if (getContextEntries(context).some(entry => entry.generator)) {
			addSuggestion(suggestions, seen, isValid, {
				kind: 'route',
				label: 'generator',
				description: context.generator.name,
				segment: 'generator',
				value: `${prefix}.generator`,
			});
		}
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
	createGeneratorTraversalAlias,
	getGeneratorTraversalSuggestions,
	parseGeneratorTraversalPath,
};

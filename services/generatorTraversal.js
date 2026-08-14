const generatorCatalog = require('./generatorCatalog');
const {
	GENERATOR_ID_PATTERN,
} = require('./generatorSchema/constants');

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
		|| parts.some(part => !GENERATOR_ID_PATTERN.test(part))
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
	const traversal = parseGeneratorTraversalPath(value);
	if (!traversal) {
		return null;
	}
	const getGenerator = options.getGenerator ?? generatorCatalog.getGenerator;
	const root = getGenerator(traversal.rootId, locale);
	if (!root || root.visibility !== 'public') {
		return null;
	}
	let contexts = [{ generator: root, entryId: traversal.rootEntryId }];
	if (!hasValidContextSelections(contexts)) {
		return null;
	}

	for (const route of traversal.routes) {
		const next = [];
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
				next.push({ generator, entryId: route.entryId });
			}
		}
		contexts = deduplicateContexts(next);
		if (!hasValidContextSelections(contexts)) {
			return null;
		}
	}

	if (
		traversal.field !== undefined
		&& contexts.some(context => (
			context.generator.entrySchema.type !== 'fields'
			|| !context.generator.entrySchema.required.includes(traversal.field)
		))
	) {
		return null;
	}
	return { contexts, traversal };
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
		return listGenerators(locale).map(generator => ({
			kind: 'generator',
			label: generator.name,
			description: generator.description,
			value: generator.id,
		}));
	}

	const delimiter = input[delimiterIndex];
	const prefix = input.slice(0, delimiterIndex);
	const contexts = analyzeGeneratorTraversalPath(
		prefix,
		locale,
		{ getGenerator },
	)?.contexts ?? [];
	if (contexts.length === 0) {
		return [];
	}
	const isValid = candidate => analyzeGeneratorTraversalPath(
		candidate,
		locale,
		{ getGenerator },
	) !== null;
	if (delimiter === ':') {
		return createEntrySuggestions(prefix, contexts, isValid);
	}
	return createMemberSuggestions(prefix, contexts, isValid);
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

function createEntrySuggestions(prefix, contexts, isValid) {
	const suggestions = [];
	const seen = new Set();
	for (const context of contexts) {
		if (context.entryId !== undefined) {
			continue;
		}
		for (const entry of context.generator.entries) {
			const value = `${prefix}:${entry.id}`;
			if (seen.has(value) || !isValid(value)) {
				continue;
			}
			seen.add(value);
			suggestions.push({
				kind: 'entry',
				label: getEntryLabel(entry),
				description: context.generator.name,
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
		if (context.generator.entrySchema.type === 'fields') {
			for (const field of context.generator.entrySchema.required) {
				addSuggestion(suggestions, seen, isValid, {
					kind: 'field',
					label: field,
					description: context.generator.name,
					value: `${prefix}.${field}`,
				});
			}
		}
		if (getContextEntries(context).some(entry => entry.generator)) {
			addSuggestion(suggestions, seen, isValid, {
				kind: 'route',
				label: 'generator',
				description: context.generator.name,
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

function getEntryLabel(entry) {
	return entry.fields?.name ?? entry.value ?? entry.id;
}

module.exports = {
	analyzeGeneratorTraversalPath,
	getGeneratorTraversalSuggestions,
	parseGeneratorTraversalPath,
};

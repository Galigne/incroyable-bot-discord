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
	const contexts = resolveGeneratorContexts(prefix, locale, getGenerator);
	if (contexts.length === 0) {
		return [];
	}
	if (delimiter === ':') {
		return createEntrySuggestions(prefix, contexts);
	}
	return createMemberSuggestions(prefix, contexts);
}

function resolveGeneratorContexts(path, locale, getGenerator) {
	const traversal = parseGeneratorTraversalPath(path);
	if (!traversal || traversal.field !== undefined) {
		return [];
	}
	const root = getGenerator(traversal.rootId, locale);
	if (!root || root.visibility !== 'public') {
		return [];
	}
	let contexts = [{ generator: root, entryId: traversal.rootEntryId }];
	for (const route of traversal.routes) {
		const next = [];
		for (const context of contexts) {
			for (const entry of getContextEntries(context)) {
				if (!entry?.generator) {
					continue;
				}
				const generator = getGenerator(entry.generator, locale);
				if (
					generator
					&& (
						route.entryId === undefined
						|| generator.entries.some(candidate => candidate.id === route.entryId)
					)
				) {
					next.push({ generator, entryId: route.entryId });
				}
			}
		}
		contexts = deduplicateContexts(next);
	}
	return contexts;
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

function createEntrySuggestions(prefix, contexts) {
	const suggestions = [];
	const seen = new Set();
	for (const context of contexts) {
		if (context.entryId !== undefined) {
			continue;
		}
		for (const entry of context.generator.entries) {
			const value = `${prefix}:${entry.id}`;
			if (seen.has(value)) {
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

function createMemberSuggestions(prefix, contexts) {
	const suggestions = [];
	const seen = new Set();
	for (const context of contexts) {
		if (context.generator.entrySchema.type === 'fields') {
			for (const field of context.generator.entrySchema.required) {
				addSuggestion(suggestions, seen, {
					kind: 'field',
					label: field,
					description: context.generator.name,
					value: `${prefix}.${field}`,
				});
			}
		}
		if (getContextEntries(context).some(entry => entry.generator)) {
			addSuggestion(suggestions, seen, {
				kind: 'route',
				label: 'generator',
				description: context.generator.name,
				value: `${prefix}.generator`,
			});
		}
	}
	return suggestions;
}

function addSuggestion(suggestions, seen, suggestion) {
	if (!seen.has(suggestion.value)) {
		seen.add(suggestion.value);
		suggestions.push(suggestion);
	}
}

function getEntryLabel(entry) {
	return entry.fields?.name ?? entry.value ?? entry.id;
}

module.exports = {
	getGeneratorTraversalSuggestions,
	parseGeneratorTraversalPath,
};

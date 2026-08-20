const {
	analyzeGeneratorTraversalPath,
	createScopedGeneratorTraversalPath,
} = require('./generatorTraversal');

function prepareScopedRoutedArchetype({
	getGenerator,
	locale = 'en',
	rootId,
	scopedPath,
}) {
	if (typeof getGenerator !== 'function') {
		throw new TypeError('Routed archetype selection requires catalog access.');
	}
	const router = getGenerator(rootId, locale);
	if (!router || !Array.isArray(router.entries) || router.entries.length === 0) {
		return { ok: false, reason: 'router-missing' };
	}
	const terminalGeneratorIds = new Set(
		router.entries.map(entry => entry.generator).filter(Boolean),
	);
	const traversalPath = scopedPath === undefined
		? `${rootId}.generator`
		: createScopedGeneratorTraversalPath(rootId, scopedPath);
	if (!traversalPath) {
		return { ok: false, reason: 'invalid-path' };
	}
	const analysis = analyzeGeneratorTraversalPath(
		traversalPath,
		locale,
		{
			getGenerator,
			implicitRouterSelections: true,
			listGenerators: () => [router],
		},
	);
	if (
		!analysis
		|| analysis.traversal.field !== undefined
		|| !analysis.contexts.every(context => (
			terminalGeneratorIds.has(context.generator.id)
		))
	) {
		return { ok: false, reason: 'invalid-path' };
	}
	return {
		analysis,
		ok: true,
		terminalGeneratorIds,
		traversalPath,
	};
}

function resolveScopedRoutedArchetype({
	getGenerator,
	locale = 'en',
	prepared,
	random = Math.random,
	resolver,
	rootId,
	scopedPath,
}) {
	if (typeof getGenerator !== 'function' || typeof resolver?.generate !== 'function') {
		throw new TypeError('Routed archetype selection requires catalog and resolver access.');
	}
	const preparedSelection = prepared ?? prepareScopedRoutedArchetype({
		getGenerator,
		locale,
		rootId,
		scopedPath,
	});
	if (!preparedSelection.ok) {
		return preparedSelection;
	}
	const { terminalGeneratorIds, traversalPath } = preparedSelection;
	const result = resolver.generate(
		traversalPath,
		locale,
		{
			random,
		},
	);
	if (!result) {
		return {
			ok: false,
			reason: 'route-missing',
		};
	}
	const routeEntryId = result.provenance.find(record => (
		record.type === 'entry'
		&& record.generatorId === rootId
	))?.entryId;
	const generator = getGenerator(result.generatorId, locale);
	const entry = generator?.entries.find(candidate => candidate.id === result.entryId);
	if (!routeEntryId || !entry || !terminalGeneratorIds.has(result.generatorId)) {
		return { ok: false, reason: 'route-missing' };
	}
	return {
		entry,
		generator,
		ok: true,
		result,
		routeEntryId,
		traversalPath,
	};
}

module.exports = {
	prepareScopedRoutedArchetype,
	resolveScopedRoutedArchetype,
};

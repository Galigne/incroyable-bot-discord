const { generatorResolutionError } = require('./generatorResolutionError');
const { selectWeightedEntry } = require('./weightedSelector');

function createReferenceResolver({ getGenerator, resolveSelection }) {
	if (typeof getGenerator !== 'function' || typeof resolveSelection !== 'function') {
		throw new TypeError('Reference resolution requires generator lookup and entry resolution.');
	}

	function resolveReference(reference, locale, state, path) {
		const sourceResult = resolveWeightedSource(
			reference.generator.oneOf,
			locale,
			state.random,
			path,
		);
		const entry = selectWeightedEntry(sourceResult.generator.entries, state.random);
		const requestedField = reference.select.startsWith('fields.')
			? reference.select.slice('fields.'.length)
			: undefined;
		const resolved = resolveSelection(
			sourceResult.generator,
			entry,
			'random',
			state,
			path,
			requestedField,
		);
		return {
			generatorId: sourceResult.generator.id,
			entryId: entry.id,
			value: selectResolvedOutput(resolved, reference.select),
			outputType: resolved.outputType,
			fields: resolved.fields,
			displayFields: resolved.displayFields,
			display: resolved.display,
			template: selectResolvedTemplate(resolved, reference.select),
			provenance: [...sourceResult.provenance, ...resolved.provenance],
			modifiers: resolved.modifiers,
		};
	}

	function resolveWeightedSource(sources, locale, random, path) {
		const selected = selectWeightedEntry(sources, random);
		return {
			generator: requireGenerator(selected.id, locale),
			provenance: [{
				type: 'generator-source',
				selection: 'weighted',
				generatorId: selected.id,
				path,
			}],
		};
	}

	function requireGenerator(id, locale) {
		const generator = getGenerator(id, locale);
		if (!generator) {
			throw generatorResolutionError(
				'GENERATOR_REFERENCE_MISSING',
				'The requested generator reference is unavailable.',
			);
		}
		return generator;
	}

	return {
		resolveReference,
	};
}

function selectResolvedOutput(resolved, selector) {
	if (selector === 'display') {
		return resolved.display;
	}
	if (selector === 'value' && resolved.outputType === 'value') {
		return resolved.value;
	}
	if (selector === 'fields' && resolved.outputType === 'fields') {
		return { ...resolved.fields };
	}
	if (selector.startsWith('fields.') && resolved.selectedField !== undefined) {
		return resolved.selectedField;
	}
	throw generatorResolutionError(
		'INVALID_GENERATOR_SELECTOR',
		'The generator selector is not valid for the selected entry.',
	);
}

function selectResolvedTemplate(resolved, selector) {
	if (selector === 'display') {
		return resolved.displayTemplate;
	}
	if (selector === 'value' && resolved.outputType === 'value') {
		return resolved.displayTemplate;
	}
	if (selector.startsWith('fields.') && resolved.selectedDisplayTemplate) {
		return resolved.selectedDisplayTemplate;
	}
	return undefined;
}

module.exports = {
	createReferenceResolver,
	selectResolvedOutput,
	selectResolvedTemplate,
};

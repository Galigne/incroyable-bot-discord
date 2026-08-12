const {
	assertAllowedKeys,
	assertExactKeys,
	assertPlainObject,
	assertRequiredKeys,
	generatorSchemaError,
	validateTechnicalId,
} = require('./assertions');

const INLINE_REFERENCE_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*(?::[a-z0-9]+(?:_[a-z0-9]+)*)?(?:\.[a-z0-9]+(?:_[a-z0-9]+)*)?$/;

function validateReference(reference, location) {
	assertPlainObject(reference, `Invalid generator reference: ${location}.`);
	assertAllowedKeys(
		reference,
		['generator', 'entry', 'select'],
		`Generator ${location} has unsupported reference properties.`,
	);
	assertRequiredKeys(
		reference,
		['generator', 'select'],
		`Generator ${location} is missing a source or selector.`,
	);
	if (typeof reference.generator === 'string') {
		validateTechnicalId(reference.generator, `source generator in ${location}`);
	}
	else {
		validateWeightedGeneratorSource(reference.generator, location);
		if (reference.entry !== undefined) {
			throw generatorSchemaError(
				'INVALID_GENERATOR_FIXED_REFERENCE',
				`Generator ${location} cannot fix an entry across weighted sources.`,
			);
		}
	}
	if (reference.entry !== undefined) {
		validateTechnicalId(reference.entry, `fixed entry in ${location}`);
	}
	validateSelector(reference.select, location);
}

function validateWeightedGeneratorSource(source, location) {
	assertPlainObject(source, `Generator ${location} has an invalid weighted source.`);
	assertExactKeys(
		source,
		['oneOf'],
		`Generator ${location} weighted source must contain only oneOf.`,
	);
	if (
		!Array.isArray(source.oneOf)
		|| source.oneOf.length === 0
		|| source.oneOf.length > 25
	) {
		throw generatorSchemaError(
			'INVALID_GENERATOR_SOURCE',
			`Generator ${location} must define 1 to 25 weighted sources.`,
		);
	}
	const sourceIds = new Set();
	for (const candidate of source.oneOf) {
		assertPlainObject(candidate, `Generator ${location} has an invalid source candidate.`);
		assertAllowedKeys(
			candidate,
			['id', 'weight'],
			`Generator ${location} source candidate has unsupported properties.`,
		);
		assertRequiredKeys(
			candidate,
			['id'],
			`Generator ${location} source candidate is missing an ID.`,
		);
		validateTechnicalId(candidate.id, `weighted source in ${location}`);
		if (
			candidate.weight !== undefined
			&& (!Number.isFinite(candidate.weight) || candidate.weight <= 0)
		) {
			throw generatorSchemaError(
				'INVALID_GENERATOR_SOURCE_WEIGHT',
				`Generator ${location} has an invalid source weight.`,
			);
		}
		if (sourceIds.has(candidate.id)) {
			throw generatorSchemaError(
				'DUPLICATE_GENERATOR_SOURCE',
				`Generator ${location} repeats weighted source ${candidate.id}.`,
			);
		}
		sourceIds.add(candidate.id);
	}
}

function validateSelector(selector, location) {
	if (
		selector === 'value'
		|| selector === 'fields'
		|| selector === 'display'
	) {
		return;
	}
	if (
		typeof selector === 'string'
		&& /^fields\.[a-z0-9]+(?:_[a-z0-9]+)*$/.test(selector)
	) {
		return;
	}
	throw generatorSchemaError(
		'INVALID_GENERATOR_SELECTOR',
		`Generator ${location} has an invalid selector.`,
	);
}

function parseInlineReference(expression, location = 'generator reference') {
	const normalized = typeof expression === 'string' ? expression.trim() : '';
	if (!INLINE_REFERENCE_PATTERN.test(normalized)) {
		throw generatorSchemaError(
			'INVALID_GENERATOR_INLINE_REFERENCE',
			`Generator ${location} contains an invalid inline reference.`,
		);
	}
	const [sourceAndEntry, field] = normalized.split('.');
	const [generator, entry] = sourceAndEntry.split(':');
	return { generator, entry, field };
}

function extractInlineReferences(value, location = 'generator text') {
	if (typeof value !== 'string') {
		return [];
	}
	const references = [];
	const matcher = /\{\{([^{}]*)\}\}/g;
	let cursor = 0;
	for (const match of value.matchAll(matcher)) {
		const before = value.slice(cursor, match.index);
		if (before.includes('{{') || before.includes('}}')) {
			throw generatorSchemaError(
				'INVALID_GENERATOR_INLINE_REFERENCE',
				`Generator ${location} contains malformed inline reference syntax.`,
			);
		}
		const expression = match[1].trim();
		parseInlineReference(expression, location);
		references.push(expression);
		cursor = match.index + match[0].length;
	}
	if (value.slice(cursor).includes('{{') || value.slice(cursor).includes('}}')) {
		throw generatorSchemaError(
			'INVALID_GENERATOR_INLINE_REFERENCE',
			`Generator ${location} contains malformed inline reference syntax.`,
		);
	}
	return references;
}

module.exports = {
	extractInlineReferences,
	parseInlineReference,
	validateReference,
	validateSelector,
};

const {
	assertAllowedKeys,
	assertExactKeys,
	assertPlainObject,
	assertRequiredKeys,
	generatorSchemaError,
	validateTechnicalId,
} = require('./assertions');

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
		&& selector.startsWith('fields.')
		&& selector.slice('fields.'.length).trim()
		&& selector.length <= 263
	) {
		return;
	}
	throw generatorSchemaError(
		'INVALID_GENERATOR_SELECTOR',
		`Generator ${location} has an invalid selector.`,
	);
}

function extractTemplateMarkers(value, location) {
	const markers = [...value.matchAll(/\{\{([a-z0-9]+(?:-[a-z0-9]+)*)\}\}/g)]
		.map(match => match[1]);
	const remainder = value.replace(/\{\{[a-z0-9]+(?:-[a-z0-9]+)*\}\}/g, '');
	if (remainder.includes('{{') || remainder.includes('}}')) {
		throw generatorSchemaError(
			'INVALID_GENERATOR_TEMPLATE_MARKER',
			`Generator ${location} contains an invalid template marker.`,
		);
	}
	return markers;
}

module.exports = {
	extractTemplateMarkers,
	validateReference,
	validateSelector,
};

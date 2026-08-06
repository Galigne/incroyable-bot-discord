const { generatorSchemaError } = require('./assertions');
const {
	validateCreatureGenerationRelationships,
} = require('./creatureRelationshipValidation');
const {
	validateRelationshipModifierRequests,
} = require('./modifierValidation');

function validateGeneratorRelationships(catalog) {
	if (!(catalog instanceof Map)) {
		throw new TypeError('Generator relationship validation requires a catalog map.');
	}
	for (const generator of catalog.values()) {
		if (generator.kind === 'modifier') {
			for (const targetId of generator.appliesTo) {
				if (!catalog.has(targetId)) {
					throw generatorSchemaError(
						'GENERATOR_REFERENCE_MISSING',
						`Modifier generator ${generator.id} has an unknown compatibility target.`,
					);
				}
			}
		}
		validateRelationshipModifierRequests(generator, generator.modifiers, catalog);
		for (const entry of generator.entries) {
			validateRelationshipModifierRequests(generator, entry.modifiers, catalog);
			for (const reference of Object.values(entry.references ?? {})) {
				validateReferenceRelationship(reference, catalog, generator.id);
			}
			if (entry.generation) {
				validateCreatureGenerationRelationships(
					generator,
					entry,
					catalog,
					validateReferenceRelationship,
				);
			}
		}
	}
	return true;
}

function validateReferenceRelationship(reference, catalog, ownerId) {
	const sourceIds = typeof reference.generator === 'string'
		? [reference.generator]
		: reference.generator.oneOf.map(source => source.id);
	for (const sourceId of sourceIds) {
		const source = catalog.get(sourceId);
		if (!source) {
			throw generatorSchemaError(
				'GENERATOR_REFERENCE_MISSING',
				`Generator ${ownerId} references an unknown generator.`,
			);
		}
		if (reference.entry && !source.entries.some(entry => entry.id === reference.entry)) {
			throw generatorSchemaError(
				'GENERATOR_ENTRY_NOT_FOUND',
				`Generator ${ownerId} references an unknown fixed entry.`,
			);
		}
		validateSelectorForGenerator(reference.select, source, ownerId);
	}
	return sourceIds.map(sourceId => catalog.get(sourceId));
}

function validateSelectorForGenerator(selector, source, ownerId) {
	if (selector === 'display') {
		return;
	}
	if (selector === 'value' && source.entrySchema.type === 'text') {
		return;
	}
	if (selector === 'fields' && source.entrySchema.type === 'fields') {
		return;
	}
	if (selector.startsWith('fields.') && source.entrySchema.type === 'fields') {
		const field = selector.slice('fields.'.length);
		if (source.entrySchema.required.includes(field)) {
			return;
		}
	}
	throw generatorSchemaError(
		'INVALID_GENERATOR_SELECTOR',
		`Generator ${ownerId} uses a selector unsupported by ${source.id}.`,
	);
}

module.exports = { validateGeneratorRelationships };

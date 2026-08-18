const { generatorSchemaError } = require('./assertions');

function validateGenerationRelationships(
	generator,
	entry,
	catalog,
	validateReferenceRelationship,
) {
	const generation = entry.generation ?? {};
	const ownerId = `${generator.id}:${entry.id}`;
	const rules = catalog.get('rules');
	if (
		generation.fixedRules?.some(rule => (
			!rules
			|| !rules.entrySchema.required.includes('description')
			|| !rules.entries.some(candidate => candidate.id === rule.entry)
		))
	) {
		throw generatorSchemaError(
			'GENERATOR_ENTRY_NOT_FOUND',
			`Archetype ${ownerId} references an unknown fixed RULE.`,
		);
	}
	for (const [references, label] of [
		[generation.statusEffects ?? [], 'status effect'],
		[generation.modifiers ?? [], 'modifier'],
	]) {
		for (const reference of references) {
			const sources = validateReferenceRelationship(reference, catalog, ownerId);
			assertReferenceFields(sources, ['name', 'description'], ownerId, label);
		}
	}
	if (generation.armor) {
		const sources = validateReferenceRelationship(generation.armor, catalog, ownerId);
		assertReferenceFields(
			sources,
			['name', 'description', 'ar_percentage'],
			ownerId,
			'armor',
		);
	}
	for (const reference of [
		...(generation.equipment ?? []),
		...(generation.inventory ?? []),
	]) {
		const sources = validateReferenceRelationship(reference, catalog, ownerId);
		assertGearReferenceResult(sources, reference.select, ownerId);
	}
}

function assertReferenceFields(sources, fields, ownerId, label) {
	if (sources.some(source => (
		fields.some(field => (
			field !== 'name' && !source.entrySchema.required.includes(field)
		))
	))) {
		throw generatorSchemaError(
			'INVALID_GENERATION_REFERENCE_TARGET',
			`Archetype ${ownerId} has an invalid ${label} reference.`,
		);
	}
}

function assertGearReferenceResult(sources, selector, ownerId) {
	if (selector === 'value' || selector === 'display') {
		return;
	}
	if (selector === 'fields') {
		assertReferenceFields(sources, ['name', 'description'], ownerId, 'gear');
		return;
	}
	const field = selector.slice('fields.'.length);
	if (sources.some(source => source.entries.some(entry => (
		typeof entry.fields?.[field] !== 'string'
	)))) {
		throw generatorSchemaError(
			'INVALID_GENERATION_REFERENCE_TARGET',
			`Archetype ${ownerId} has a non-text gear reference.`,
		);
	}
}

module.exports = { validateGenerationRelationships };

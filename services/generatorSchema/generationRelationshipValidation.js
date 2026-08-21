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
			|| (
				rule.entry === 'elemental_rule'
				&& (!catalog.get('element') || !catalog.get('element').entries.some(
					candidate => candidate.id === rule.element,
				)))
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
			const target = validateReferenceRelationship(reference, catalog, ownerId);
			if (target.field !== undefined) {
				throw generatorSchemaError(
					'INVALID_GENERATION_REFERENCE_TARGET',
					`Archetype ${ownerId} has an invalid ${label} reference.`,
				);
			}
			assertReferenceFields(
				target.sources,
				['name', 'description'],
				ownerId,
				label,
			);
		}
	}
	if (generation.armor) {
		const target = validateReferenceRelationship(generation.armor, catalog, ownerId);
		if (target.field !== undefined || target.sources.some(source => (
			source.id !== 'armors'
			|| !source.entrySchema.required.includes('type')
			|| !source.entrySchema.required.includes('description')
			|| source.modifiers?.modifier_rarity !== 100
		))) {
			throw generatorSchemaError(
				'INVALID_GENERATION_REFERENCE_TARGET',
				`Archetype ${ownerId} has an invalid armor reference.`,
			);
		}
	}
	for (const reference of [
		...(generation.equipment ?? []),
		...(generation.inventory ?? []),
	]) {
		const target = validateReferenceRelationship(reference, catalog, ownerId);
		assertGearReferenceResult(target, ownerId);
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

function assertGearReferenceResult(target, ownerId) {
	if (target.selector === 'value' || target.selector === 'display') {
		return;
	}
	if (target.selector === 'fields' || target.selector === 'content') {
		return;
	}
	const field = target.field;
	if (target.sources.some(source => source.entries.some(entry => (
		typeof (field === 'name' ? entry.name : entry.fields?.[field]) !== 'string'
	)))) {
		throw generatorSchemaError(
			'INVALID_GENERATION_REFERENCE_TARGET',
			`Archetype ${ownerId} has a non-text gear reference.`,
		);
	}
}

module.exports = { validateGenerationRelationships };

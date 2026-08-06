const {
	assertAllowedKeys,
	assertExactKeys,
	assertPlainObject,
	assertRequiredKeys,
	generatorSchemaError,
	validateDisplayText,
	validateTechnicalId,
} = require('./assertions');
const {
	CREATURE_GENERATOR_IDS,
	CREATURE_ROUTER_ID,
	MAX_ENTRY_TEXT_LENGTH,
} = require('./constants');
const { validateReference } = require('./referenceValidation');

function validateCreatureGeneratorEnvelope(generator, entrySchema, file) {
	if (generator.id === CREATURE_ROUTER_ID) {
		if (
			generator.kind !== 'category'
			|| generator.visibility !== 'public'
			|| entrySchema.type !== 'fields'
			|| JSON.stringify(entrySchema.required)
				!== JSON.stringify(['Name', 'Description', 'Generator'])
			|| JSON.stringify(entrySchema.technical ?? [])
				!== JSON.stringify(['Generator'])
		) {
			throw generatorSchemaError(
				'INVALID_CREATURE_ROUTER_SCHEMA',
				`Creature router ${file} must expose localized Name and Description fields plus a technical Generator field.`,
			);
		}
		return;
	}
	if (!CREATURE_GENERATOR_IDS.has(generator.id)) {
		return;
	}
	if (
		generator.kind !== 'component'
		|| generator.visibility !== 'internal'
		|| entrySchema.type !== 'fields'
		|| JSON.stringify(entrySchema.required) !== JSON.stringify(['Name', 'Description'])
		|| (entrySchema.technical?.length ?? 0) !== 0
	) {
		throw generatorSchemaError(
			'INVALID_CREATURE_ARCHETYPE_SCHEMA',
			`Creature detail generator ${file} must be an internal component exposing localized Name and Description fields.`,
		);
	}
}

function validateCreatureGeneration(generation, location) {
	assertPlainObject(
		generation,
		`Creature archetype ${location} must define generation metadata.`,
	);
	assertAllowedKeys(
		generation,
		[
			'statProfile',
			'naturalArmorPercentage',
			'traits',
			'fixedRules',
			'statusEffects',
			'armor',
			'equipment',
			'inventory',
		],
		`Creature archetype ${location} contains unsupported generation metadata.`,
	);
	assertRequiredKeys(
		generation,
		['statProfile', 'traits', 'equipment', 'inventory'],
		`Creature archetype ${location} is missing required generation metadata.`,
	);
	validateTechnicalId(generation.statProfile, `statistical profile in ${location}`);
	if (
		generation.naturalArmorPercentage !== undefined
		&& (
			!Number.isFinite(generation.naturalArmorPercentage)
			|| generation.naturalArmorPercentage < 0
			|| generation.naturalArmorPercentage > 100
		)
	) {
		throw generatorSchemaError(
			'INVALID_CREATURE_NATURAL_ARMOR',
			`Creature archetype ${location} has invalid natural armor.`,
		);
	}
	validateCreatureTraits(generation.traits, location);
	validateFixedRules(generation.fixedRules ?? [], location);
	validateReferenceList(
		generation.statusEffects ?? [],
		`${location} status effects`,
		{ requiredSelector: 'fields' },
	);
	if (generation.armor !== undefined) {
		if (generation.naturalArmorPercentage !== undefined) {
			throw generatorSchemaError(
				'CREATURE_ARMOR_SOURCE_CONFLICT',
				`Creature archetype ${location} cannot combine generated armor and natural armor.`,
			);
		}
		validateReference(generation.armor, `${location} armor`);
		if (generation.armor.select !== 'fields') {
			throw generatorSchemaError(
				'INVALID_CREATURE_ARMOR_REFERENCE',
				`Creature archetype ${location} armor must select complete fields.`,
			);
		}
	}
	validateReferenceList(generation.equipment, `${location} equipment`);
	validateReferenceList(generation.inventory, `${location} inventory`);
}

function validateCreatureTraits(traits, location) {
	if (!Array.isArray(traits) || traits.length === 0 || traits.length > 25) {
		throw generatorSchemaError(
			'INVALID_CREATURE_TRAITS',
			`Creature archetype ${location} must define 1 to 25 intrinsic traits.`,
		);
	}
	const ids = new Set();
	for (const [index, trait] of traits.entries()) {
		assertPlainObject(trait, `Creature trait ${location}.${index} is invalid.`);
		assertExactKeys(
			trait,
			['id', 'Name', 'Description'],
			`Creature trait ${location}.${index} has invalid properties.`,
		);
		validateTechnicalId(trait.id, `trait ID in ${location}`);
		validateDisplayText(trait.Name, 256, `trait name in ${location}`);
		validateDisplayText(
			trait.Description,
			MAX_ENTRY_TEXT_LENGTH,
			`trait description in ${location}`,
		);
		if (ids.has(trait.id)) {
			throw generatorSchemaError(
				'DUPLICATE_CREATURE_TRAIT_ID',
				`Creature archetype ${location} repeats trait ${trait.id}.`,
			);
		}
		ids.add(trait.id);
	}
}

function validateFixedRules(rules, location) {
	if (!Array.isArray(rules) || rules.length > 25) {
		throw generatorSchemaError(
			'INVALID_CREATURE_FIXED_RULES',
			`Creature archetype ${location} has invalid fixed RULEs.`,
		);
	}
	const entries = new Set();
	for (const rule of rules) {
		assertPlainObject(rule, `Creature archetype ${location} has an invalid fixed RULE.`);
		assertExactKeys(
			rule,
			['entry', 'level'],
			`Creature archetype ${location} fixed RULE has invalid properties.`,
		);
		validateTechnicalId(rule.entry, `fixed RULE entry in ${location}`);
		if (!Number.isInteger(rule.level) || rule.level < 1 || rule.level > 10) {
			throw generatorSchemaError(
				'INVALID_CREATURE_FIXED_RULE_LEVEL',
				`Creature archetype ${location} has an invalid fixed RULE level.`,
			);
		}
		if (entries.has(rule.entry)) {
			throw generatorSchemaError(
				'DUPLICATE_CREATURE_FIXED_RULE',
				`Creature archetype ${location} repeats fixed RULE ${rule.entry}.`,
			);
		}
		entries.add(rule.entry);
	}
}

function validateReferenceList(references, location, options = {}) {
	if (!Array.isArray(references) || references.length > 25) {
		throw generatorSchemaError(
			'INVALID_CREATURE_REFERENCES',
			`Creature archetype ${location} must be an array with at most 25 references.`,
		);
	}
	for (const [index, reference] of references.entries()) {
		validateReference(reference, `${location}.${index}`);
		if (
			options.requiredSelector
			&& reference.select !== options.requiredSelector
		) {
			throw generatorSchemaError(
				'INVALID_CREATURE_REFERENCE_SELECTOR',
				`Creature archetype ${location}.${index} must select ${options.requiredSelector}.`,
			);
		}
	}
}

module.exports = {
	validateCreatureGeneration,
	validateCreatureGeneratorEnvelope,
};

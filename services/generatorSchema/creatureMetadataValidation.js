const {
	assertAllowedKeys,
	assertExactKeys,
	assertPlainObject,
	assertRequiredKeys,
	generatorSchemaError,
	validateDisplayText,
	validateStableId,
} = require('./assertions');
const {
	CREATURE_ROUTER_ID,
	MAX_ENTRY_TEXT_LENGTH,
} = require('./constants');
const { validateReference } = require('./referenceValidation');

function validateCreatureGeneratorEnvelope(
	generator,
	entrySchema,
	file,
	options = {},
) {
	if (generator.id === CREATURE_ROUTER_ID) {
		if (
			generator.visibility !== 'public'
			|| !options.isRouter
		) {
			throw generatorSchemaError(
				'INVALID_CREATURE_ROUTER_SCHEMA',
				`Creature router ${file} must be a public structural router.`,
			);
		}
		return;
	}
	if (!isCreatureDetailGenerator(generator.id, options)) {
		return;
	}
	if (
		generator.visibility !== 'internal'
		|| options.isRouter
		|| JSON.stringify(entrySchema.required) !== JSON.stringify(['description'])
	) {
		throw generatorSchemaError(
			'INVALID_CREATURE_ARCHETYPE_SCHEMA',
			`Creature detail generator ${file} must be internal with localized names and description fields.`,
		);
	}
}

function isCreatureDetailGenerator(generatorId, options = {}) {
	return options.creatureGeneratorIds instanceof Set
		&& options.creatureGeneratorIds.has(generatorId);
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
			'modifiers',
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
	if (
		typeof generation.statProfile !== 'string'
		|| !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(generation.statProfile)
	) {
		throw generatorSchemaError(
			'INVALID_CREATURE_STAT_PROFILE',
			`Creature archetype ${location} has an invalid statistical profile.`,
		);
	}
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
	for (const [references, label] of [
		[generation.statusEffects ?? [], 'status effects'],
		[generation.modifiers ?? [], 'modifiers'],
	]) {
		validateReferenceList(
			references,
			`${location} ${label}`,
			{ requiredSelector: 'fields' },
		);
	}
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
	if (!Array.isArray(traits) || traits.length > 25) {
		throw generatorSchemaError(
			'INVALID_CREATURE_TRAITS',
			`Creature archetype ${location} must define up to 25 intrinsic traits.`,
		);
	}
	for (const [index, trait] of traits.entries()) {
		validateDisplayText(
			trait,
			MAX_ENTRY_TEXT_LENGTH,
			`trait ${index + 1} in ${location}`,
		);
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
		validateStableId(rule.entry, `fixed RULE entry in ${location}`);
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
	isCreatureDetailGenerator,
	validateCreatureGeneration,
	validateCreatureGeneratorEnvelope,
};

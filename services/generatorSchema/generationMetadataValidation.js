const {
	COMMON_GENERATION_PROPERTIES,
	TEMPLATE_PROPERTY_BY_ENTITY_TYPE,
} = require('../generationMetadata');
const {
	assertAllowedKeys,
	assertExactKeys,
	assertPlainObject,
	generatorSchemaError,
	validateDisplayText,
	validateStableId,
} = require('./assertions');
const { MAX_ENTRY_TEXT_LENGTH } = require('./constants');
const { validateReference } = require('./referenceValidation');

function validateGenerationMetadata(generation, location, entityType) {
	const templateProperty = TEMPLATE_PROPERTY_BY_ENTITY_TYPE[entityType];
	if (!templateProperty) {
		throw new TypeError(`Unsupported generation metadata entity type: ${entityType}.`);
	}
	assertPlainObject(
		generation,
		`${entityLabel(entityType)} archetype ${location} has invalid generation metadata.`,
	);
	assertAllowedKeys(
		generation,
		[...COMMON_GENERATION_PROPERTIES, templateProperty],
		`${entityLabel(entityType)} archetype ${location} contains unsupported generation metadata.`,
	);
	if (generation.statProfile !== undefined) {
		validateStatProfile(generation.statProfile, location, entityType);
	}
	if (generation.naturalArmorPercentage !== undefined) {
		validateNaturalArmorPercentage(
			generation.naturalArmorPercentage,
			location,
			entityType,
		);
	}
	if (generation[templateProperty] !== undefined) {
		validateTemplateStrings(
			generation[templateProperty],
			location,
			entityType,
			templateProperty,
		);
	}
	if (generation.fixedRules !== undefined) {
		validateFixedRules(generation.fixedRules, location, entityType);
	}
	for (const [references, label] of [
		[generation.statusEffects, 'status effects'],
		[generation.modifiers, 'modifiers'],
	]) {
		if (references !== undefined) {
			validateReferenceList(references, `${location} ${label}`, entityType, {
				requiredSelector: 'fields',
			});
		}
	}
	if (generation.armor !== undefined) {
		validateReference(generation.armor, `${location} armor`);
		if (
			typeof generation.armor !== 'string'
			&& generation.armor.select !== 'fields'
		) {
			throw generatorSchemaError(
				'INVALID_GENERATION_ARMOR_REFERENCE',
				`${entityLabel(entityType)} archetype ${location} armor must select complete fields.`,
			);
		}
	}
	for (const property of ['equipment', 'inventory']) {
		if (generation[property] !== undefined) {
			validateReferenceList(
				generation[property],
				`${location} ${property}`,
				entityType,
			);
		}
	}
}

function validateStatProfile(profileId, location, entityType) {
	if (
		typeof profileId !== 'string'
		|| !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(profileId)
	) {
		throw generatorSchemaError(
			'INVALID_GENERATION_STAT_PROFILE',
			`${entityLabel(entityType)} archetype ${location} has an invalid statistical profile.`,
		);
	}
}

function validateNaturalArmorPercentage(percentage, location, entityType) {
	if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
		throw generatorSchemaError(
			'INVALID_GENERATION_NATURAL_ARMOR',
			`${entityLabel(entityType)} archetype ${location} has invalid natural armor.`,
		);
	}
}

function validateTemplateStrings(templates, location, entityType, property) {
	if (!Array.isArray(templates) || templates.length > 25) {
		throw generatorSchemaError(
			'INVALID_GENERATION_TEMPLATES',
			`${entityLabel(entityType)} archetype ${location} must define up to 25 ${property}.`,
		);
	}
	for (const [index, template] of templates.entries()) {
		validateDisplayText(
			template,
			MAX_ENTRY_TEXT_LENGTH,
			`${property} template ${index + 1} in ${location}`,
		);
	}
}

function validateFixedRules(rules, location, entityType) {
	if (!Array.isArray(rules) || rules.length > 25) {
		throw generatorSchemaError(
			'INVALID_GENERATION_FIXED_RULES',
			`${entityLabel(entityType)} archetype ${location} has invalid fixed RULEs.`,
		);
	}
	const entries = new Set();
	for (const rule of rules) {
		assertPlainObject(
			rule,
			`${entityLabel(entityType)} archetype ${location} has an invalid fixed RULE.`,
		);
		const allowedKeys = rule.entry === 'elemental_rule'
			? ['entry', 'element', 'level']
			: ['entry', 'level'];
		assertExactKeys(
			rule,
			allowedKeys,
			`${entityLabel(entityType)} archetype ${location} fixed RULE has invalid properties.`,
		);
		validateStableId(rule.entry, `fixed RULE entry in ${location}`);
		if (rule.entry === 'elemental_rule') {
			validateStableId(rule.element, `fixed RULE element in ${location}`);
		}
		if (!Number.isInteger(rule.level) || rule.level < 1 || rule.level > 10) {
			throw generatorSchemaError(
				'INVALID_GENERATION_FIXED_RULE_LEVEL',
				`${entityLabel(entityType)} archetype ${location} has an invalid fixed RULE level.`,
			);
		}
		if (entries.has(rule.entry)) {
			throw generatorSchemaError(
				'DUPLICATE_GENERATION_FIXED_RULE',
				`${entityLabel(entityType)} archetype ${location} repeats fixed RULE ${rule.entry}.`,
			);
		}
		entries.add(rule.entry);
	}
}

function validateReferenceList(references, location, entityType, options = {}) {
	if (!Array.isArray(references) || references.length > 25) {
		throw generatorSchemaError(
			'INVALID_GENERATION_REFERENCES',
			`${entityLabel(entityType)} archetype ${location} must be an array with at most 25 references.`,
		);
	}
	for (const [index, reference] of references.entries()) {
		validateReference(reference, `${location}.${index}`);
		if (
			options.requiredSelector
			&& typeof reference !== 'string'
			&& reference.select !== options.requiredSelector
		) {
			throw generatorSchemaError(
				'INVALID_GENERATION_REFERENCE_SELECTOR',
				`${entityLabel(entityType)} archetype ${location}.${index} must select ${options.requiredSelector}.`,
			);
		}
	}
}

function entityLabel(entityType) {
	return entityType === 'character' ? 'Character background' : 'Creature';
}

module.exports = { validateGenerationMetadata };

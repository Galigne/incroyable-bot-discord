const GENERATOR_SCHEMA_VERSION = 2;
const GENERATOR_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const GENERATOR_KINDS = new Set(['category', 'component', 'modifier', 'template']);
const GENERATOR_VISIBILITIES = new Set(['internal', 'public']);
const MAX_ENTRY_TEXT_LENGTH = 4_096;
const MAX_FIELD_VALUE_LENGTH = 1_024;
const MAX_MODIFIER_REQUESTS = 25;
const MAX_MODIFIER_COUNT = 25;
const CREATURE_ARCHETYPE_IDS = new Set(['animal', 'companion', 'monster']);
const CREATURE_GENERATOR_BY_ARCHETYPE = Object.freeze(Object.fromEntries(
	[...CREATURE_ARCHETYPE_IDS].map(archetype => [
		archetype,
		`creature-${archetype}`,
	]),
));
const CREATURE_GENERATOR_IDS = new Set(
	Object.values(CREATURE_GENERATOR_BY_ARCHETYPE),
);
const CREATURE_ROUTER_ID = 'creature';
const FORBIDDEN_MODIFIER_FIELDS = new Set([
	'armor',
	'behavior',
	'derived statistics',
	'effects',
	'entity type',
	'equipment',
	'inventory',
	'mechanics',
	'resources',
	'rules',
	'statistics',
	'status effects',
	'traits',
]);

function validateGeneratorDefinition(generator, file = '<generator>') {
	assertPlainObject(generator, `Invalid generator document: ${file}.`);
	assertAllowedKeys(
		generator,
		[
			'schemaVersion',
			'id',
			'kind',
			'visibility',
			'name',
			'description',
			'appliesTo',
			'entrySchema',
			'modifiers',
			'entries',
		],
		`Invalid generator envelope: ${file}.`,
	);
	assertRequiredKeys(
		generator,
		[
			'schemaVersion',
			'id',
			'kind',
			'visibility',
			'name',
			'description',
			'entrySchema',
			'entries',
		],
		`Generator ${file} is missing a required envelope property.`,
	);
	if (generator.schemaVersion !== GENERATOR_SCHEMA_VERSION) {
		throw generatorSchemaError(
			'INVALID_GENERATOR_SCHEMA_VERSION',
			`Generator ${file} must use schemaVersion ${GENERATOR_SCHEMA_VERSION}.`,
		);
	}
	validateTechnicalId(generator.id, `generator ID in ${file}`);
	if (!GENERATOR_KINDS.has(generator.kind)) {
		throw generatorSchemaError(
			'INVALID_GENERATOR_KIND',
			`Generator ${file} has an unsupported kind.`,
		);
	}
	if (!GENERATOR_VISIBILITIES.has(generator.visibility)) {
		throw generatorSchemaError(
			'INVALID_GENERATOR_VISIBILITY',
			`Generator ${file} has an unsupported visibility.`,
		);
	}
	validateDisplayText(generator.name, 256, `generator name in ${file}`);
	validateDisplayText(
		generator.description,
		MAX_ENTRY_TEXT_LENGTH,
		`generator description in ${file}`,
	);
	validateGeneratorKindProperties(generator, file);
	const entrySchema = validateEntrySchema(generator.entrySchema, generator.kind, file);
	validateCreatureGeneratorEnvelope(generator, entrySchema, file);
	if (generator.modifiers !== undefined) {
		validateModifierRequests(generator.modifiers, `${file} modifiers`);
	}
	if (!Array.isArray(generator.entries) || generator.entries.length === 0) {
		throw generatorSchemaError(
			'INVALID_GENERATOR_ENTRIES',
			`Generator ${file} must contain at least one entry.`,
		);
	}

	const entryIds = new Set();
	generator.entries.forEach((entry, index) => {
		validateGeneratorEntry(entry, entrySchema, generator, file, index);
		if (entryIds.has(entry.id)) {
			throw generatorSchemaError(
				'DUPLICATE_GENERATOR_ENTRY_ID',
				`Generator ${file} contains duplicate entry ID ${entry.id}.`,
			);
		}
		entryIds.add(entry.id);
	});
	const totalWeight = generator.entries.reduce(
		(total, entry) => total + (entry.weight ?? 1),
		0,
	);
	if (!Number.isFinite(totalWeight)) {
		throw generatorSchemaError(
			'INVALID_GENERATOR_TOTAL_WEIGHT',
			`Generator ${file} has a non-finite total weight.`,
		);
	}
	return generator;
}

function validateGeneratorKindProperties(generator, file) {
	if (generator.kind === 'modifier') {
		if (generator.visibility !== 'internal') {
			throw generatorSchemaError(
				'INVALID_MODIFIER_VISIBILITY',
				`Modifier generator ${file} must be internal.`,
			);
		}
		validateTechnicalIdList(generator.appliesTo, file, 'appliesTo');
		if (generator.modifiers !== undefined) {
			throw generatorSchemaError(
				'INVALID_MODIFIER_REQUEST',
				`Modifier generator ${file} cannot request other modifiers.`,
			);
		}
		return;
	}
	if (generator.appliesTo !== undefined) {
		throw generatorSchemaError(
			'INVALID_MODIFIER_COMPATIBILITY',
			`Non-modifier generator ${file} cannot define appliesTo.`,
		);
	}
}

function validateGeneratorPair(english, french, file = '<generator>') {
	validateGeneratorDefinition(english, `en/${file}`);
	validateGeneratorDefinition(french, `fr/${file}`);
	for (const property of [
		'schemaVersion',
		'id',
		'kind',
		'visibility',
		'appliesTo',
		'entrySchema',
		'modifiers',
	]) {
		assertParity(english[property], french[property], file, property);
	}
	assertParity(english.entries.length, french.entries.length, file, 'entries.length');

	const technicalFields = new Set(english.entrySchema.technical ?? []);
	for (let index = 0; index < english.entries.length; index += 1) {
		const englishEntry = english.entries[index];
		const frenchEntry = french.entries[index];
		assertParity(
			Object.keys(englishEntry).sort(),
			Object.keys(frenchEntry).sort(),
			file,
			`entries.${index}.keys`,
		);
		for (const property of ['id', 'weight', 'modifiers', 'references']) {
			assertParity(
				englishEntry[property],
				frenchEntry[property],
				file,
				`entries.${index}.${property}`,
			);
		}
		if (english.entrySchema.type === 'fields') {
			validateFieldsPair(
				englishEntry,
				frenchEntry,
				english.entrySchema,
				technicalFields,
				file,
				index,
			);
		}
		else {
			const localizedProperty = english.entrySchema.type === 'template'
				? 'template'
				: 'value';
			assertParity(
				extractPlaceholders(englishEntry[localizedProperty]),
				extractPlaceholders(frenchEntry[localizedProperty]),
				file,
				`entries.${index}.${localizedProperty}.placeholders`,
			);
		}
		if (CREATURE_GENERATOR_IDS.has(english.id)) {
			validateCreatureGenerationPair(
				englishEntry.generation,
				frenchEntry.generation,
				file,
				index,
			);
		}
	}
	return true;
}

function validateFieldsPair(
	englishEntry,
	frenchEntry,
	entrySchema,
	technicalFields,
	file,
	index,
) {
	assertParity(
		Object.keys(englishEntry.fields),
		Object.keys(frenchEntry.fields),
		file,
		`entries.${index}.fields`,
	);
	for (const field of entrySchema.required) {
		const location = `entries.${index}.fields.${field}`;
		assertParity(
			typeOfField(englishEntry.fields[field]),
			typeOfField(frenchEntry.fields[field]),
			file,
			`${location}.type`,
		);
		if (technicalFields.has(field)) {
			assertParity(
				englishEntry.fields[field],
				frenchEntry.fields[field],
				file,
				location,
			);
		}
		else if (typeof englishEntry.fields[field] === 'string') {
			assertParity(
				extractPlaceholders(englishEntry.fields[field]),
				extractPlaceholders(frenchEntry.fields[field]),
				file,
				`${location}.placeholders`,
			);
		}
	}
}

function validateEntrySchema(entrySchema, generatorKind, file) {
	assertPlainObject(entrySchema, `Generator ${file} has an invalid entrySchema.`);
	if (entrySchema.type === 'text' || entrySchema.type === 'template') {
		assertExactKeys(
			entrySchema,
			['type'],
			`Generator ${file} may only define entrySchema.type for this payload.`,
		);
		if (
			generatorKind === 'modifier'
			|| (generatorKind === 'template') !== (entrySchema.type === 'template')
		) {
			throw generatorSchemaError(
				'INVALID_GENERATOR_ENTRY_SCHEMA',
				`Generator ${file} has a kind and entry schema mismatch.`,
			);
		}
		return entrySchema;
	}
	if (entrySchema.type !== 'fields' || generatorKind === 'template') {
		throw generatorSchemaError(
			'INVALID_GENERATOR_ENTRY_SCHEMA',
			`Generator ${file} must use a text, fields, or template entry schema.`,
		);
	}
	assertAllowedKeys(
		entrySchema,
		['type', 'required', 'technical'],
		`Generator ${file} has unsupported entrySchema properties.`,
	);
	validateFieldNameList(entrySchema.required, file, 'required');
	if (entrySchema.technical !== undefined) {
		validateFieldNameList(entrySchema.technical, file, 'technical', true);
		const required = new Set(entrySchema.required);
		if (entrySchema.technical.some(field => !required.has(field))) {
			throw generatorSchemaError(
				'INVALID_GENERATOR_ENTRY_SCHEMA',
				`Generator ${file} declares an unknown technical field.`,
			);
		}
	}
	if (generatorKind === 'modifier') {
		validateModifierEntrySchema(entrySchema, file);
	}
	return entrySchema;
}

function validateModifierEntrySchema(entrySchema, file) {
	const required = new Set(entrySchema.required);
	const technical = new Set(entrySchema.technical ?? []);
	if (!required.has('Name') || !required.has('Description')) {
		throw generatorSchemaError(
			'INVALID_MODIFIER_ENTRY_SCHEMA',
			`Modifier generator ${file} must declare Name and Description.`,
		);
	}
	if (technical.has('Name') || technical.has('Description')) {
		throw generatorSchemaError(
			'INVALID_MODIFIER_ENTRY_SCHEMA',
			`Modifier generator ${file} must localize Name and Description.`,
		);
	}
	if (entrySchema.required.some(field => (
		FORBIDDEN_MODIFIER_FIELDS.has(field.trim().toLowerCase())
	))) {
		throw generatorSchemaError(
			'MODIFIER_MECHANICAL_FIELD',
			`Modifier generator ${file} declares a mechanical field.`,
		);
	}
}

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

function validateCreatureGenerationPair(english, french, file, index) {
	const location = `entries.${index}.generation`;
	const technicalProperties = [
		'statProfile',
		'naturalArmorPercentage',
		'fixedRules',
		'statusEffects',
		'armor',
		'equipment',
		'inventory',
	];
	assertParity(Object.keys(english).sort(), Object.keys(french).sort(), file, `${location}.keys`);
	for (const property of technicalProperties) {
		assertParity(english[property], french[property], file, `${location}.${property}`);
	}
	assertParity(english.traits.length, french.traits.length, file, `${location}.traits.length`);
	for (let traitIndex = 0; traitIndex < english.traits.length; traitIndex += 1) {
		const englishTrait = english.traits[traitIndex];
		const frenchTrait = french.traits[traitIndex];
		assertParity(
			Object.keys(englishTrait).sort(),
			Object.keys(frenchTrait).sort(),
			file,
			`${location}.traits.${traitIndex}.keys`,
		);
		assertParity(
			englishTrait.id,
			frenchTrait.id,
			file,
			`${location}.traits.${traitIndex}.id`,
		);
		for (const property of ['Name', 'Description']) {
			assertParity(
				extractPlaceholders(englishTrait[property]),
				extractPlaceholders(frenchTrait[property]),
				file,
				`${location}.traits.${traitIndex}.${property}.placeholders`,
			);
		}
	}
}

function validateFieldNameList(fields, file, property, allowEmpty = false) {
	if (
		!Array.isArray(fields)
		|| (!allowEmpty && fields.length === 0)
		|| fields.length > 25
		|| new Set(fields).size !== fields.length
		|| fields.some(field => (
			typeof field !== 'string'
			|| !field.trim()
			|| field.length > 256
		))
	) {
		throw generatorSchemaError(
			'INVALID_GENERATOR_ENTRY_SCHEMA',
			`Generator ${file} has an invalid ${property} field list.`,
		);
	}
}

function validateGeneratorEntry(entry, entrySchema, generator, file, index) {
	const location = `${file} entry ${index + 1}`;
	const generatorKind = generator.kind;
	assertPlainObject(entry, `Invalid generator entry: ${location}.`);
	validateTechnicalId(entry.id, `entry ID at ${location}`);
	if (
		entry.weight !== undefined
		&& (!Number.isFinite(entry.weight) || entry.weight <= 0)
	) {
		throw generatorSchemaError(
			'INVALID_GENERATOR_ENTRY_WEIGHT',
			`Generator ${location} has an invalid weight.`,
		);
	}
	if (entry.modifiers !== undefined) {
		if (generatorKind === 'modifier') {
			throw generatorSchemaError(
				'INVALID_MODIFIER_REQUEST',
				`Modifier entry ${location} cannot request other modifiers.`,
			);
		}
		validateModifierRequests(entry.modifiers, `${location} modifiers`);
	}

	const commonKeys = [
		'id',
		'weight',
		'modifiers',
		...(CREATURE_GENERATOR_IDS.has(generator.id) ? ['generation'] : []),
	];
	if (entrySchema.type === 'text') {
		assertAllowedKeys(
			entry,
			[...commonKeys, 'value'],
			`Generator ${location} has unsupported properties.`,
		);
		assertRequiredKeys(
			entry,
			['id', 'value'],
			`Generator ${location} must contain one text value.`,
		);
		validateDisplayText(entry.value, MAX_ENTRY_TEXT_LENGTH, location);
		return;
	}
	if (entrySchema.type === 'template') {
		validateTemplateEntry(entry, commonKeys, location);
		return;
	}

	assertAllowedKeys(
		entry,
		[...commonKeys, 'fields'],
		`Generator ${location} has unsupported properties.`,
	);
	assertRequiredKeys(
		entry,
		['id', 'fields'],
		`Generator ${location} must contain one fields object.`,
	);
	assertPlainObject(entry.fields, `Generator ${location} has invalid fields.`);
	assertExactKeys(
		entry.fields,
		entrySchema.required,
		`Generator ${location} does not match its required field schema.`,
	);
	const technicalFields = new Set(entrySchema.technical ?? []);
	for (const [field, value] of Object.entries(entry.fields)) {
		if (
			!['string', 'number', 'boolean'].includes(typeof value)
			|| !String(value).trim()
			|| String(value).length > MAX_FIELD_VALUE_LENGTH
		) {
			throw generatorSchemaError(
				'INVALID_GENERATOR_FIELD_VALUE',
				`Generator ${location} has an invalid ${field} value.`,
			);
		}
		if (typeof value !== 'string' && !technicalFields.has(field)) {
			throw generatorSchemaError(
				'INVALID_GENERATOR_ENTRY_SCHEMA',
				`Generator ${location} must declare non-text field ${field} as technical.`,
			);
		}
	}
	if (CREATURE_GENERATOR_IDS.has(generator.id)) {
		validateCreatureGeneration(entry.generation, location);
	}
}

function validateTemplateEntry(entry, commonKeys, location) {
	assertAllowedKeys(
		entry,
		[...commonKeys, 'template', 'references'],
		`Generator ${location} has unsupported properties.`,
	);
	assertRequiredKeys(
		entry,
		['id', 'template', 'references'],
		`Generator ${location} must contain a template and references.`,
	);
	validateDisplayText(entry.template, MAX_ENTRY_TEXT_LENGTH, `${location} template`);
	assertPlainObject(entry.references, `Generator ${location} has invalid references.`);
	const referenceNames = Object.keys(entry.references);
	if (referenceNames.length === 0 || referenceNames.length > 25) {
		throw generatorSchemaError(
			'INVALID_GENERATOR_REFERENCES',
			`Generator ${location} must contain 1 to 25 references.`,
		);
	}
	for (const [name, reference] of Object.entries(entry.references)) {
		validateTechnicalId(name, `reference name in ${location}`);
		validateReference(reference, `${location} reference ${name}`);
	}
	const markers = extractTemplateMarkers(entry.template, location);
	if (JSON.stringify([...new Set(markers)].sort()) !== JSON.stringify(referenceNames.sort())) {
		throw generatorSchemaError(
			'GENERATOR_TEMPLATE_REFERENCE_MISMATCH',
			`Generator ${location} template markers and references must match.`,
		);
	}
}

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

function validateModifierRequests(requests, location) {
	if (
		!Array.isArray(requests)
		|| requests.length === 0
		|| requests.length > MAX_MODIFIER_REQUESTS
	) {
		throw generatorSchemaError(
			'INVALID_MODIFIER_REQUEST',
			`Generator ${location} must contain 1 to ${MAX_MODIFIER_REQUESTS} modifier requests.`,
		);
	}
	for (const request of requests) {
		assertPlainObject(request, `Generator ${location} has an invalid modifier request.`);
		assertExactKeys(
			request,
			['generator', 'chance', 'count'],
			`Generator ${location} modifier request has invalid properties.`,
		);
		validateTechnicalId(request.generator, `modifier generator in ${location}`);
		if (
			!Number.isFinite(request.chance)
			|| request.chance < 0
			|| request.chance > 1
		) {
			throw generatorSchemaError(
				'INVALID_MODIFIER_CHANCE',
				`Generator ${location} has an invalid modifier chance.`,
			);
		}
		assertPlainObject(request.count, `Generator ${location} has an invalid modifier count.`);
		assertExactKeys(
			request.count,
			['min', 'max'],
			`Generator ${location} modifier count has invalid properties.`,
		);
		if (
			!Number.isInteger(request.count.min)
			|| !Number.isInteger(request.count.max)
			|| request.count.min < 0
			|| request.count.max < request.count.min
			|| request.count.max > MAX_MODIFIER_COUNT
		) {
			throw generatorSchemaError(
				'INVALID_MODIFIER_COUNT',
				`Generator ${location} has invalid modifier count bounds.`,
			);
		}
	}
}

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
				validateCreatureGenerationRelationships(generator, entry, catalog);
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

function validateCreatureGenerationRelationships(generator, entry, catalog) {
	const generation = entry.generation;
	const ownerId = `${generator.id}:${entry.id}`;
	const rules = catalog.get('rules');
	if (
		generation.fixedRules?.some(rule => (
			!rules
			|| rules.entrySchema.type !== 'fields'
			|| !rules.entrySchema.required.includes('Name')
			|| !rules.entrySchema.required.includes('Description')
			|| !rules.entries.some(candidate => candidate.id === rule.entry)
		))
	) {
		throw generatorSchemaError(
			'GENERATOR_ENTRY_NOT_FOUND',
			`Creature archetype ${ownerId} references an unknown fixed RULE.`,
		);
	}
	for (const reference of generation.statusEffects ?? []) {
		const sources = validateReferenceRelationship(reference, catalog, ownerId);
		assertReferenceFields(sources, ['Name', 'Description'], ownerId, 'status effect');
	}
	if (generation.armor) {
		const sources = validateReferenceRelationship(generation.armor, catalog, ownerId);
		assertReferenceFields(
			sources,
			['Name', 'Description', 'AR percentage'],
			ownerId,
			'armor',
		);
	}
	for (const reference of [
		...generation.equipment,
		...generation.inventory,
	]) {
		const sources = validateReferenceRelationship(reference, catalog, ownerId);
		assertGearReferenceResult(sources, reference.select, ownerId);
	}
}

function assertReferenceFields(sources, fields, ownerId, label) {
	if (sources.some(source => (
		source.entrySchema.type !== 'fields'
		|| fields.some(field => !source.entrySchema.required.includes(field))
	))) {
		throw generatorSchemaError(
			'INVALID_CREATURE_REFERENCE_TARGET',
			`Creature archetype ${ownerId} has an invalid ${label} reference.`,
		);
	}
}

function assertGearReferenceResult(sources, selector, ownerId) {
	if (selector === 'value' || selector === 'display') {
		return;
	}
	if (selector === 'fields') {
		assertReferenceFields(sources, ['Name', 'Description'], ownerId, 'gear');
		return;
	}
	const field = selector.slice('fields.'.length);
	if (sources.some(source => source.entries.some(entry => (
		typeof entry.fields?.[field] !== 'string'
	)))) {
		throw generatorSchemaError(
			'INVALID_CREATURE_REFERENCE_TARGET',
			`Creature archetype ${ownerId} has a non-text gear reference.`,
		);
	}
}

function validateCreatureStatProfileRelationships(catalogs, profiles) {
	if (!(catalogs instanceof Map) || !(profiles instanceof Map)) {
		throw new TypeError('Creature profile validation requires catalog and profile maps.');
	}
	for (const locale of ['en', 'fr']) {
		const catalog = catalogs.get(locale);
		if (!(catalog instanceof Map)) {
			throw new TypeError(`Creature profile validation is missing the ${locale} catalog.`);
		}
		const router = catalog.get(CREATURE_ROUTER_ID);
		if (!router) {
			throw generatorSchemaError(
				'CREATURE_ROUTER_MISSING',
				`Creature generation is missing the ${locale} ${CREATURE_ROUTER_ID} router.`,
			);
		}
		if (
			router.entries.length !== CREATURE_ARCHETYPE_IDS.size
			|| router.entries.some(entry => !CREATURE_ARCHETYPE_IDS.has(entry.id))
		) {
			throw generatorSchemaError(
				'CREATURE_ROUTE_INVALID',
				`Creature generation has invalid ${locale} router entries.`,
			);
		}
		for (const archetypeId of CREATURE_ARCHETYPE_IDS) {
			const generatorId = CREATURE_GENERATOR_BY_ARCHETYPE[archetypeId];
			const route = router.entries.find(entry => entry.id === archetypeId);
			if (route?.fields?.Generator !== generatorId) {
				throw generatorSchemaError(
					'CREATURE_ROUTE_INVALID',
					`Creature generation has an invalid ${locale} ${archetypeId} route.`,
				);
			}
			const generator = catalog.get(generatorId);
			if (!generator) {
				throw generatorSchemaError(
					'CREATURE_ARCHETYPE_MISSING',
					`Creature generation is missing the ${locale} ${generatorId} archetype.`,
				);
			}
			for (const entry of generator.entries) {
				if (!profiles.has(entry.generation.statProfile)) {
					throw generatorSchemaError(
						'CREATURE_STAT_PROFILE_MISSING',
						`Creature archetype ${generatorId}:${entry.id} references an unknown statistical profile.`,
					);
				}
			}
		}
	}
	return true;
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

function validateRelationshipModifierRequests(generator, requests, catalog) {
	for (const request of requests ?? []) {
		const modifier = catalog.get(request.generator);
		if (!modifier || modifier.kind !== 'modifier') {
			throw generatorSchemaError(
				'GENERATOR_REFERENCE_MISSING',
				`Generator ${generator.id} requests an unknown modifier generator.`,
			);
		}
		if (!modifier.appliesTo.includes(generator.id)) {
			throw generatorSchemaError(
				'GENERATOR_MODIFIER_INCOMPATIBLE',
				`Generator ${generator.id} requests an incompatible modifier.`,
			);
		}
		if (request.count.max > modifier.entries.length) {
			throw generatorSchemaError(
				'GENERATOR_MODIFIER_COUNT_UNAVAILABLE',
				`Generator ${generator.id} requests too many unique modifiers.`,
			);
		}
	}
}

function validateTechnicalIdList(ids, file, property) {
	if (!Array.isArray(ids) || ids.length === 0 || new Set(ids).size !== ids.length) {
		throw generatorSchemaError(
			'INVALID_MODIFIER_COMPATIBILITY',
			`Generator ${file} has an invalid ${property} list.`,
		);
	}
	for (const id of ids) {
		validateTechnicalId(id, `${property} value in ${file}`);
	}
}

function validateTechnicalId(id, label) {
	if (
		typeof id !== 'string'
		|| id.length > 100
		|| !GENERATOR_ID_PATTERN.test(id)
	) {
		throw generatorSchemaError(
			'INVALID_GENERATOR_ID',
			`Invalid stable technical ${label}.`,
		);
	}
}

function validateDisplayText(value, maximumLength, label) {
	if (
		typeof value !== 'string'
		|| !value.trim()
		|| value.length > maximumLength
	) {
		throw generatorSchemaError(
			'INVALID_GENERATOR_TEXT',
			`Invalid localized text for ${label}.`,
		);
	}
}

function assertPlainObject(value, message) {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw generatorSchemaError('INVALID_GENERATOR_STRUCTURE', message);
	}
}

function assertAllowedKeys(value, allowedKeys, message) {
	const allowed = new Set(allowedKeys);
	if (Object.keys(value).some(key => !allowed.has(key))) {
		throw generatorSchemaError('INVALID_GENERATOR_STRUCTURE', message);
	}
}

function assertRequiredKeys(value, requiredKeys, message) {
	if (requiredKeys.some(key => !Object.hasOwn(value, key))) {
		throw generatorSchemaError('INVALID_GENERATOR_STRUCTURE', message);
	}
}

function assertExactKeys(value, expectedKeys, message) {
	const actual = Object.keys(value).sort();
	const expected = [...expectedKeys].sort();
	if (JSON.stringify(actual) !== JSON.stringify(expected)) {
		throw generatorSchemaError('INVALID_GENERATOR_STRUCTURE', message);
	}
}

function assertParity(english, french, file, property) {
	if (JSON.stringify(english) !== JSON.stringify(french)) {
		throw generatorSchemaError(
			'GENERATOR_LOCALE_PARITY_MISMATCH',
			`English and French generator data differ at ${file}:${property}.`,
		);
	}
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

function extractPlaceholders(value) {
	return [
		...value.matchAll(/\{\{[^{}]+\}\}|\$\{[^{}]+\}|%\w/g),
	].map(match => match[0]).sort();
}

function typeOfField(value) {
	return Array.isArray(value) ? 'array' : typeof value;
}

function generatorSchemaError(code, message) {
	const error = new Error(message);
	error.name = 'GeneratorSchemaError';
	error.code = code;
	return error;
}

module.exports = {
	CREATURE_ARCHETYPE_IDS: Object.freeze([...CREATURE_ARCHETYPE_IDS]),
	CREATURE_GENERATOR_BY_ARCHETYPE,
	CREATURE_GENERATOR_IDS: Object.freeze([...CREATURE_GENERATOR_IDS]),
	CREATURE_ROUTER_ID,
	GENERATOR_SCHEMA_VERSION,
	validateCreatureStatProfileRelationships,
	validateGeneratorDefinition,
	validateGeneratorPair,
	validateGeneratorRelationships,
};

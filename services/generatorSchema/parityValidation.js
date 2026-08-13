const { generatorSchemaError } = require('./assertions');
const { isCreatureDetailGenerator } = require('./creatureMetadataValidation');
const { validateGeneratorDefinition } = require('./envelopeValidation');
const { extractInlineReferences } = require('./referenceValidation');

function validateGeneratorPair(
	english,
	french,
	file = '<generator>',
	options = {},
) {
	validateGeneratorDefinition(english, `en/${file}`, options);
	validateGeneratorDefinition(french, `fr/${file}`, options);
	for (const property of [
		'schemaVersion',
		'id',
		'visibility',
		'entrySchema',
		'modifiers',
	]) {
		assertParity(english[property], french[property], file, property);
	}
	assertParity(
		extractInlineReferences(english.name, `${file} name`),
		extractInlineReferences(french.name, `${file} name`),
		file,
		'name.inlineReferences',
	);
	assertParity(
		extractInlineReferences(english.description, `${file} description`),
		extractInlineReferences(french.description, `${file} description`),
		file,
		'description.inlineReferences',
	);
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
		for (const property of ['id', 'weight']) {
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
			const localizedProperty = 'value';
			assertParity(
				extractInlineReferences(englishEntry[localizedProperty], file),
				extractInlineReferences(frenchEntry[localizedProperty], file),
				file,
				`entries.${index}.${localizedProperty}.inlineReferences`,
			);
		}
		if (isCreatureDetailGenerator(english.id, options)) {
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
				extractInlineReferences(englishEntry.fields[field], file),
				extractInlineReferences(frenchEntry.fields[field], file),
				file,
				`${location}.inlineReferences`,
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
		'modifiers',
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
		assertParity(
			extractInlineReferences(english.traits[traitIndex], file),
			extractInlineReferences(french.traits[traitIndex], file),
			file,
			`${location}.traits.${traitIndex}.inlineReferences`,
		);
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

function typeOfField(value) {
	return Array.isArray(value) ? 'array' : typeof value;
}

module.exports = { validateGeneratorPair };

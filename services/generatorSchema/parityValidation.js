const { generatorSchemaError } = require('./assertions');
const {
	isBackgroundArchetypeGenerator,
} = require('./backgroundMetadataValidation');
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

	for (let index = 0; index < english.entries.length; index += 1) {
		const englishEntry = english.entries[index];
		const frenchEntry = french.entries[index];
		assertParity(
			Object.keys(englishEntry).sort(),
			Object.keys(frenchEntry).sort(),
			file,
			`entries.${index}.keys`,
		);
		for (const property of ['id', 'weight', 'generator']) {
			assertParity(
				englishEntry[property],
				frenchEntry[property],
				file,
				`entries.${index}.${property}`,
			);
		}
		assertParity(
			extractInlineReferences(englishEntry.name, file),
			extractInlineReferences(frenchEntry.name, file),
			file,
			`entries.${index}.name.inlineReferences`,
		);
		if (english.entrySchema.required.length > 0) {
			validateFieldsPair(
				englishEntry,
				frenchEntry,
				english.entrySchema,
				file,
				index,
			);
		}
		if (isCreatureDetailGenerator(english.id, options)) {
			validateGenerationPair(
				englishEntry.generation,
				frenchEntry.generation,
				file,
				index,
				'traits',
			);
		}
		if (isBackgroundArchetypeGenerator(english.id, options)) {
			validateGenerationPair(
				englishEntry.generation,
				frenchEntry.generation,
				file,
				index,
				'talents',
			);
		}
	}
	return true;
}

function validateFieldsPair(
	englishEntry,
	frenchEntry,
	entrySchema,
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
		if (typeof englishEntry.fields[field] !== 'string') {
			assertParity(
				englishEntry.fields[field],
				frenchEntry.fields[field],
				file,
				location,
			);
		}
		else {
			assertParity(
				extractInlineReferences(englishEntry.fields[field], file),
				extractInlineReferences(frenchEntry.fields[field], file),
				file,
				`${location}.inlineReferences`,
			);
		}
	}
}

function validateGenerationPair(english, french, file, index, templateProperty) {
	const location = `entries.${index}.generation`;
	if (english === undefined && french === undefined) {
		return;
	}
	const functionalProperties = [
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
	for (const property of functionalProperties) {
		assertParity(english[property], french[property], file, `${location}.${property}`);
	}
	if (english[templateProperty] === undefined) {
		return;
	}
	assertParity(
		english[templateProperty].length,
		french[templateProperty].length,
		file,
		`${location}.${templateProperty}.length`,
	);
	for (
		let templateIndex = 0;
		templateIndex < english[templateProperty].length;
		templateIndex += 1
	) {
		assertParity(
			extractInlineReferences(english[templateProperty][templateIndex], file),
			extractInlineReferences(french[templateProperty][templateIndex], file),
			file,
			`${location}.${templateProperty}.${templateIndex}.inlineReferences`,
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

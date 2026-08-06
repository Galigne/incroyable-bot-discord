const { generatorSchemaError } = require('./assertions');
const { CREATURE_GENERATOR_IDS } = require('./constants');
const { validateGeneratorDefinition } = require('./envelopeValidation');

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

function assertParity(english, french, file, property) {
	if (JSON.stringify(english) !== JSON.stringify(french)) {
		throw generatorSchemaError(
			'GENERATOR_LOCALE_PARITY_MISMATCH',
			`English and French generator data differ at ${file}:${property}.`,
		);
	}
}

function extractPlaceholders(value) {
	return [
		...value.matchAll(/\{\{[^{}]+\}\}|\$\{[^{}]+\}|%\w/g),
	].map(match => match[0]).sort();
}

function typeOfField(value) {
	return Array.isArray(value) ? 'array' : typeof value;
}

module.exports = { validateGeneratorPair };

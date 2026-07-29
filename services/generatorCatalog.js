const fs = require('node:fs');
const path = require('node:path');

const generatorsDirectory = path.join(__dirname, '..', 'data', 'generators');
const cachedGenerators = new Map();
const DEFAULT_LOCALE = 'en';
const SUPPORTED_LOCALES = new Set(['en', 'fr']);

function loadGenerators(locale = DEFAULT_LOCALE) {
	const normalizedLocale = normalizeGeneratorLocale(locale);
	if (cachedGenerators.has(normalizedLocale)) {
		return cachedGenerators.get(normalizedLocale);
	}

	const englishDirectory = path.join(generatorsDirectory, DEFAULT_LOCALE);
	const localizedDirectory = path.join(generatorsDirectory, normalizedLocale);
	const generators = new Map();
	const files = fs.readdirSync(englishDirectory)
		.filter(file => file.endsWith('.json'))
		.sort();

	for (const file of files) {
		const englishPath = path.join(englishDirectory, file);
		const localizedPath = path.join(localizedDirectory, file);
		const englishGenerator = readGenerator(englishPath, file);
		const selectedPath = selectLocalizedGeneratorPath(
			englishPath,
			localizedPath,
			normalizedLocale,
		);
		const localizedGenerator = selectedPath === englishPath
			? englishGenerator
			: readGenerator(selectedPath, file);
		const id = englishGenerator.name;
		const key = normalizeCategoryName(id);

		if (generators.has(key)) {
			throw new Error(`Duplicate generator category: ${id}`);
		}
		generators.set(key, Object.freeze({
			...localizedGenerator,
			id,
			key,
			locale: normalizedLocale,
			entries: Object.freeze(localizedGenerator.entries.map(freezeEntry)),
		}));
	}

	if (generators.size === 0) {
		throw new Error('No generator categories were found.');
	}

	cachedGenerators.set(normalizedLocale, generators);
	return generators;
}

function clearGeneratorCache() {
	cachedGenerators.clear();
}

function normalizeGeneratorLocale(locale) {
	return SUPPORTED_LOCALES.has(locale) ? locale : DEFAULT_LOCALE;
}

function readGenerator(filePath, file) {
	const generator = JSON.parse(fs.readFileSync(filePath, 'utf8'));
	validateCategory(generator, file);
	return generator;
}

function selectLocalizedGeneratorPath(englishPath, localizedPath, locale) {
	return locale !== DEFAULT_LOCALE && fs.existsSync(localizedPath)
		? localizedPath
		: englishPath;
}

function listGenerators(locale = DEFAULT_LOCALE) {
	return [...loadGenerators(locale).values()]
		.sort((left, right) => left.name.localeCompare(right.name, locale));
}

function getGenerator(id, locale = DEFAULT_LOCALE) {
	return loadGenerators(locale).get(normalizeCategoryName(id));
}

function generate(id, locale = DEFAULT_LOCALE, random = Math.random) {
	// Preserve the former generate(id, random) form for service callers.
	if (typeof locale === 'function') {
		random = locale;
		locale = DEFAULT_LOCALE;
	}
	const generator = getGenerator(id, locale);
	if (!generator) {
		return null;
	}
	return {
		category: generator,
		entry: selectWeightedEntry(generator.entries, random),
	};
}

function selectWeightedEntry(entries, random = Math.random) {
	const totalWeight = entries.reduce(
		(total, entry) => total + getEntryWeight(entry),
		0,
	);
	const randomValue = Math.max(0, Math.min(0.9999999999999999, random()));
	let target = randomValue * totalWeight;

	for (const entry of entries) {
		target -= getEntryWeight(entry);
		if (target < 0) {
			return entry;
		}
	}
	return entries.at(-1);
}

function getEntryWeight(entry) {
	return typeof entry === 'string' ? 1 : entry.weight ?? 1;
}

function normalizeCategoryName(name = '') {
	const normalizedName = name.trim().toLowerCase().replace(/[\s_-]+/g, '');
	if (normalizedName.endsWith('ies')) {
		return `${normalizedName.slice(0, -3)}y`;
	}
	return normalizedName.replace(/s$/, '');
}

function validateCategory(category, file) {
	if (
		typeof category?.name !== 'string'
		|| !category.name.trim()
		|| typeof category.description !== 'string'
		|| !category.description.trim()
		|| !Array.isArray(category.entries)
		|| category.entries.length === 0
	) {
		throw new Error(`Invalid generator category file: ${file}`);
	}

	category.entries.forEach((entry, index) => validateEntry(entry, file, index));
	const totalWeight = category.entries.reduce(
		(total, entry) => total + getEntryWeight(entry),
		0,
	);
	if (!Number.isFinite(totalWeight)) {
		throw new Error(`Generator weights are too large in ${file}.`);
	}
}

function validateEntry(entry, file, index) {
	if (typeof entry === 'string') {
		if (!entry.trim() || entry.length > 4_096) {
			throw new Error(`Invalid generator entry ${index + 1} in ${file}.`);
		}
		return;
	}

	if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
		throw new Error(`Invalid generator entry ${index + 1} in ${file}.`);
	}

	const allowedKeys = new Set(['fields', 'value', 'weight']);
	if (Object.keys(entry).some(key => !allowedKeys.has(key))) {
		throw new Error(
			`Generator entry ${index + 1} in ${file} may only contain fields and weight.`,
		);
	}
	if (
		entry.weight !== undefined
		&& (!Number.isFinite(entry.weight) || entry.weight <= 0)
	) {
		throw new Error(
			`Generator entry ${index + 1} in ${file} has an invalid weight.`,
		);
	}
	const hasFields = entry.fields !== undefined;
	const hasValue = entry.value !== undefined;
	if (hasFields === hasValue) {
		throw new Error(
			`Generator entry ${index + 1} in ${file} must have either value or fields.`,
		);
	}
	if (hasValue) {
		if (
			typeof entry.value !== 'string'
			|| !entry.value.trim()
			|| entry.value.length > 4_096
		) {
			throw new Error(`Generator entry ${index + 1} in ${file} has an invalid value.`);
		}
		return;
	}
	if (
		!entry.fields
		|| typeof entry.fields !== 'object'
		|| Array.isArray(entry.fields)
		|| Object.keys(entry.fields).length === 0
		|| Object.keys(entry.fields).length > 25
	) {
		throw new Error(
			`Generator entry ${index + 1} in ${file} must have 1 to 25 fields.`,
		);
	}

	for (const [label, value] of Object.entries(entry.fields)) {
		if (
			!label.trim()
			|| label.length > 256
			|| !['string', 'number', 'boolean'].includes(typeof value)
			|| !String(value).trim()
			|| String(value).length > 1_024
		) {
			throw new Error(
				`Generator entry ${index + 1} in ${file} has an invalid field.`,
			);
		}
	}
}

function freezeEntry(entry) {
	if (typeof entry === 'string') {
		return entry;
	}
	return Object.freeze({
		...entry,
		...(entry.fields ? { fields: Object.freeze({ ...entry.fields }) } : {}),
	});
}

module.exports = {
	clearGeneratorCache,
	generate,
	getEntryWeight,
	getGenerator,
	getCategory: getGenerator,
	listGenerators,
	listCategories: listGenerators,
	normalizeCategoryName,
	selectLocalizedGeneratorPath,
	selectWeightedEntry,
};

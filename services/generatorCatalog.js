const fs = require('node:fs');
const path = require('node:path');
const {
	validateGeneratorPair,
	validateGeneratorRelationships,
} = require('./generatorSchema');

const generatorsDirectory = path.join(__dirname, '..', 'data', 'generators');
const DEFAULT_LOCALE = 'en';
const SUPPORTED_LOCALES = new Set(['en', 'fr']);
const VISIBILITY_FILTERS = new Set(['all', 'internal', 'public']);
let cachedCatalog = null;

function getGenerator(id, locale = DEFAULT_LOCALE) {
	if (typeof id !== 'string') {
		return undefined;
	}
	return loadGeneratorCatalog().get(normalizeGeneratorLocale(locale)).get(id);
}

function listGenerators(locale = DEFAULT_LOCALE, options = {}) {
	const visibility = options.visibility ?? 'public';
	if (!VISIBILITY_FILTERS.has(visibility)) {
		throw new TypeError(`Unsupported generator visibility filter: ${visibility}.`);
	}
	return [
		...loadGeneratorCatalog().get(normalizeGeneratorLocale(locale)).values(),
	]
		.filter(generator => (
			visibility === 'all' || generator.visibility === visibility
		))
		.sort((left, right) => left.name.localeCompare(right.name, locale));
}

function clearGeneratorCache() {
	cachedCatalog = null;
}

function reloadGeneratorCatalog() {
	return replaceGeneratorCatalog(createGeneratorCatalogCandidate());
}

function createGeneratorCatalogCandidate(rootDirectory = generatorsDirectory) {
	return readGeneratorCatalog(rootDirectory);
}

function replaceGeneratorCatalog(catalog) {
	cachedCatalog = catalog;
	return catalog;
}

function loadGeneratorCatalog() {
	if (!cachedCatalog) {
		cachedCatalog = readGeneratorCatalog(generatorsDirectory);
	}
	return cachedCatalog;
}

function readGeneratorCatalog(rootDirectory) {
	const englishDirectory = path.join(rootDirectory, 'en');
	const frenchDirectory = path.join(rootDirectory, 'fr');
	const englishFiles = listJsonFiles(englishDirectory);
	const frenchFiles = listJsonFiles(frenchDirectory);
	if (JSON.stringify(englishFiles) !== JSON.stringify(frenchFiles)) {
		throw generatorCatalogError(
			'GENERATOR_LOCALE_FILE_MISMATCH',
			'English and French generator directories must contain the same JSON files.',
		);
	}
	if (englishFiles.length === 0) {
		throw generatorCatalogError(
			'NO_GENERATORS',
			'No generator definitions were found.',
		);
	}

	const catalogs = new Map([
		['en', new Map()],
		['fr', new Map()],
	]);
	for (const relativePath of englishFiles) {
		const english = readGenerator(
			path.join(englishDirectory, relativePath),
			`en/${relativePath}`,
		);
		const french = readGenerator(
			path.join(frenchDirectory, relativePath),
			`fr/${relativePath}`,
		);
		validateGeneratorPair(english, french, relativePath);
		if (catalogs.get('en').has(english.id)) {
			throw generatorCatalogError(
				'DUPLICATE_GENERATOR_ID',
				`Duplicate generator ID: ${english.id}.`,
			);
		}
		catalogs.get('en').set(english.id, freezeGenerator(english, 'en'));
		catalogs.get('fr').set(french.id, freezeGenerator(french, 'fr'));
	}
	validateGeneratorRelationships(catalogs.get('en'));
	validateGeneratorRelationships(catalogs.get('fr'));
	return catalogs;
}

function listJsonFiles(directory, relativeDirectory = '') {
	const files = [];
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		const relativePath = path.join(relativeDirectory, entry.name);
		const absolutePath = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...listJsonFiles(absolutePath, relativePath));
		}
		else if (entry.isFile() && entry.name.endsWith('.json')) {
			files.push(relativePath);
		}
	}
	return files.sort();
}

function readGenerator(filePath, displayPath) {
	try {
		return JSON.parse(fs.readFileSync(filePath, 'utf8'));
	}
	catch (error) {
		throw generatorCatalogError(
			'INVALID_GENERATOR_JSON',
			`Unable to read generator ${displayPath}: ${error.message}`,
		);
	}
}

function freezeGenerator(generator, locale) {
	return deepFreeze({
		...generator,
		locale,
		entrySchema: { ...generator.entrySchema },
		entries: generator.entries.map(entry => ({ ...entry })),
	});
}

function deepFreeze(value) {
	if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
		return value;
	}
	for (const nestedValue of Object.values(value)) {
		deepFreeze(nestedValue);
	}
	return Object.freeze(value);
}

function normalizeGeneratorLocale(locale) {
	return SUPPORTED_LOCALES.has(locale) ? locale : DEFAULT_LOCALE;
}

function generatorCatalogError(code, message) {
	const error = new Error(message);
	error.name = 'GeneratorCatalogError';
	error.code = code;
	return error;
}

module.exports = {
	clearGeneratorCache,
	createGeneratorCatalogCandidate,
	getGenerator,
	listGenerators,
	reloadGeneratorCatalog,
	replaceGeneratorCatalog,
};

const fs = require('node:fs');
const path = require('node:path');

const en = require('../locales/en.json');
const fr = require('../locales/fr.json');

const DEFAULT_LOCALE = 'en';
const DEFAULT_CATALOG_PATHS = Object.freeze({
	en: path.join(__dirname, '..', 'locales', 'en.json'),
	fr: path.join(__dirname, '..', 'locales', 'fr.json'),
});
const translations = { en, fr };
const REQUIRED_TRANSLATION_KEYS = new Set(flattenKeys(en));
const reportedMissingKeys = new Set();

function normalizeLocale(locale) {
	return Object.hasOwn(translations, locale) ? locale : DEFAULT_LOCALE;
}

function getLocale(config = {}) {
	return normalizeLocale(config.locale);
}

function createTranslator(catalogs, onMissing = reportMissingKey) {
	return (locale, key, variables = {}) => {
		const normalizedLocale = Object.hasOwn(catalogs, locale) ? locale : DEFAULT_LOCALE;
		let value = getTranslation(catalogs[normalizedLocale], key);
		if (value === undefined && normalizedLocale !== DEFAULT_LOCALE) {
			onMissing(normalizedLocale, key);
			value = getTranslation(catalogs[DEFAULT_LOCALE], key);
		}
		if (value === undefined) {
			onMissing(DEFAULT_LOCALE, key);
			return key;
		}
		if (typeof value !== 'string') {
			onMissing(normalizedLocale, key, 'Translation is not a string');
			return key;
		}
		return value.replace(/\{\{(\w+)\}\}/g, (match, variable) => (
			Object.hasOwn(variables, variable) ? String(variables[variable]) : match
		));
	};
}

const t = createTranslator(translations);

function getTranslation(catalog, key) {
	return key.split('.').reduce((value, part) => value?.[part], catalog);
}

function hasTranslationKey(locale, key) {
	const normalizedLocale = normalizeLocale(locale);
	return typeof key === 'string'
		&& typeof getTranslation(translations[normalizedLocale], key) === 'string';
}

function loadTranslationCatalogs(catalogPaths = DEFAULT_CATALOG_PATHS) {
	const candidates = Object.fromEntries(
		Object.entries(DEFAULT_CATALOG_PATHS).map(([locale, defaultPath]) => [
			locale,
			JSON.parse(fs.readFileSync(catalogPaths[locale] ?? defaultPath, 'utf8')),
		]),
	);
	validateTranslationCatalogs(candidates);
	return candidates;
}

function reloadTranslations(catalogPaths = DEFAULT_CATALOG_PATHS) {
	const candidates = loadTranslationCatalogs(catalogPaths);
	replaceTranslationCatalogs(candidates);
	return translations;
}

function replaceTranslationCatalogs(catalogs) {
	validateTranslationCatalogs(catalogs);
	for (const locale of Object.keys(DEFAULT_CATALOG_PATHS)) {
		translations[locale] = catalogs[locale];
	}
	reportedMissingKeys.clear();
	return translations;
}

function validateTranslationCatalogs(catalogs) {
	for (const locale of Object.keys(DEFAULT_CATALOG_PATHS)) {
		const catalog = catalogs?.[locale];
		if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) {
			throw new Error(`Invalid ${locale} localization catalog.`);
		}
		const invalidKey = flattenKeys(catalog).find(key => (
			!key || typeof getTranslation(catalog, key) !== 'string'
		));
		if (invalidKey !== undefined) {
			throw new Error(`Invalid translation value for ${locale}:${invalidKey}.`);
		}
		const keys = new Set(flattenKeys(catalog));
		if ([...REQUIRED_TRANSLATION_KEYS].some(key => !keys.has(key))) {
			throw new Error(
				`${locale} localization catalog does not match the runtime schema.`,
			);
		}
	}

	const missing = findMissingKeys(catalogs);
	if (Object.values(missing).some(keys => keys.length > 0)) {
		throw new Error('Localization catalogs must contain exactly the same keys.');
	}
	return catalogs;
}

function reportMissingKey(locale, key, reason = 'Missing translation') {
	const identifier = `${locale}:${key}:${reason}`;
	if (!reportedMissingKeys.has(identifier)) {
		reportedMissingKeys.add(identifier);
		console.warn(`[i18n] ${reason} "${key}" for locale "${locale}".`);
	}
}

function findMissingKeys(catalogs = translations) {
	const localeEntries = Object.entries(catalogs);
	const allKeys = new Set(localeEntries.flatMap(([, catalog]) => flattenKeys(catalog)));
	const missing = {};
	for (const [locale, catalog] of localeEntries) {
		const keys = new Set(flattenKeys(catalog));
		missing[locale] = [...allKeys].filter(key => !keys.has(key)).sort();
	}
	return missing;
}

function flattenKeys(value, prefix = '') {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return [prefix];
	}
	return Object.entries(value).flatMap(([key, child]) => (
		flattenKeys(child, prefix ? `${prefix}.${key}` : key)
	));
}

module.exports = {
	DEFAULT_LOCALE,
	DEFAULT_CATALOG_PATHS,
	createTranslator,
	findMissingKeys,
	flattenKeys,
	getLocale,
	hasTranslationKey,
	loadTranslationCatalogs,
	normalizeLocale,
	reloadTranslations,
	replaceTranslationCatalogs,
	t,
	translations,
	validateTranslationCatalogs,
};

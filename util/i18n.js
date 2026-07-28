const en = require('../locales/en.json');
const fr = require('../locales/fr.json');

const DEFAULT_LOCALE = 'en';
const translations = { en, fr };
const reportedMissingKeys = new Set();

function normalizeLocale(locale) {
	return Object.hasOwn(translations, locale) ? locale : DEFAULT_LOCALE;
}

function getLocale(config = {}, guildId) {
	const configuredLocale = config.guildLocales?.[guildId] ?? config.locale;
	return normalizeLocale(configuredLocale);
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

function localizeDescription(builder, key) {
	return builder
		.setDescription(t('en', key))
		.setDescriptionLocalizations({ fr: t('fr', key) });
}

function getTranslation(catalog, key) {
	return key.split('.').reduce((value, part) => value?.[part], catalog);
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
	createTranslator,
	findMissingKeys,
	flattenKeys,
	getLocale,
	localizeDescription,
	normalizeLocale,
	t,
	translations,
};

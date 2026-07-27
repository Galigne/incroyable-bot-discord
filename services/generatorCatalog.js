const fs = require('node:fs');
const path = require('node:path');

const generatorsDirectory = path.join(__dirname, '..', 'data', 'generators');
let cachedCategories;

function loadCategories() {
	if (cachedCategories) {
		return cachedCategories;
	}

	const categories = new Map();
	const files = fs.readdirSync(generatorsDirectory)
		.filter(file => file.endsWith('.json'))
		.sort();

	for (const file of files) {
		const filePath = path.join(generatorsDirectory, file);
		const category = JSON.parse(fs.readFileSync(filePath, 'utf8'));
		validateCategory(category, file);

		const key = normalizeCategoryName(category.name);
		if (categories.has(key)) {
			throw new Error(`Duplicate generator category: ${category.name}`);
		}
		categories.set(key, Object.freeze({
			...category,
			key,
			entries: Object.freeze(category.entries.map(freezeEntry)),
		}));
	}

	if (categories.size === 0) {
		throw new Error('No generator categories were found.');
	}

	cachedCategories = categories;
	return categories;
}

function listCategories() {
	return [...loadCategories().values()]
		.sort((left, right) => left.name.localeCompare(right.name));
}

function getCategory(name) {
	return loadCategories().get(normalizeCategoryName(name));
}

function generate(categoryName, random = Math.random) {
	const category = getCategory(categoryName);
	if (!category) {
		return null;
	}
	return {
		category,
		entry: selectWeightedEntry(category.entries, random),
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
	const normalizedName = name.trim().toLowerCase().replace(/[\s_]+/g, '-');
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
	generate,
	getEntryWeight,
	getCategory,
	listCategories,
	normalizeCategoryName,
	selectWeightedEntry,
};

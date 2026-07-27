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
			entries: Object.freeze([...category.entries]),
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
	const index = Math.floor(random() * category.entries.length);
	return {
		category,
		entry: category.entries[index],
	};
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
		|| category.entries.some(entry => typeof entry !== 'string' || !entry.trim())
	) {
		throw new Error(`Invalid generator category file: ${file}`);
	}
}

module.exports = {
	generate,
	getCategory,
	listCategories,
	normalizeCategoryName,
};

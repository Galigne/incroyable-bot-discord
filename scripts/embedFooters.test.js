const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const Character = require('../models/Character');
const {
	createCharacterGetResponse,
	createGeneratedCharacterResponse,
} = require('../util/characterCommandResponses');
const { createGeneratedEmbed } = require('../util/generatorResponses');
const { flattenKeys, translations } = require('../util/i18n');

const root = path.join(__dirname, '..');

test('generated prompt embeds have no footer', () => {
	const embed = createGeneratedEmbed({
		category: { name: 'prompt' },
		entry: 'A generated prompt',
	}).toJSON();

	assert.equal(embed.footer, undefined);
});

test('character summary and detail embeds have no footer', () => {
	const character = new Character('Footer.Test', 'creator');
	const summary = createCharacterGetResponse(character, null, 'en')
		.embeds[0].toJSON();
	const detail = createCharacterGetResponse(character, 'race', 'en')
		.embeds[0].toJSON();

	assert.equal(summary.footer, undefined);
	assert.equal(detail.footer, undefined);
});

test('generated character embeds have no footer', () => {
	const character = new Character('Generated.Footer.Test', 'creator');
	const embed = createGeneratedCharacterResponse(character, 'en')
		.embeds[0].toJSON();

	assert.equal(embed.footer, undefined);
});

test('embed-building source contains no footer setter calls', () => {
	const forbiddenCall = ['.set', 'Footer('].join('');
	const matches = getJavaScriptFiles(root)
		.filter(file => fs.readFileSync(file, 'utf8').includes(forbiddenCall))
		.map(file => path.relative(root, file));

	assert.deepEqual(matches, []);
});

test('locale catalogs have identical structures and no footer keys', () => {
	const englishKeys = flattenKeys(translations.en).sort();
	const frenchKeys = flattenKeys(translations.fr).sort();

	assert.deepEqual(englishKeys, frenchKeys);
	assert.deepEqual(
		englishKeys.filter(key => key.toLowerCase().includes('footer')),
		[],
	);
});

function getJavaScriptFiles(directory) {
	return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
		if (entry.name === '.git' || entry.name === 'node_modules') {
			return [];
		}
		const entryPath = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			return getJavaScriptFiles(entryPath);
		}
		return entry.isFile() && entry.name.endsWith('.js') ? [entryPath] : [];
	});
}

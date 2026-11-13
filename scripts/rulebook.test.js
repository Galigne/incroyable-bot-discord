const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { test } = require('node:test');
const { createRenderer, renderBook, sourceStart, sourceEnd, plainText } = require('../documentation/rulebook/build');
const editions = require('../documentation/rulebook/editions');

const illustratedSections = [
	['cover', 'ttrpg-random'], ['characters', 'character-creation'], ['rule', 'rule'],
	['dice', 'types-of-dice'], ['combat', 'combat'], ['attacks', 'attacks'],
	['weapons', 'weapons'], ['defense', 'defense-saving-and-survival'], ['armor', 'armor-ar'],
	['runes', 'enchantments-and-runes'], ['camp', 'adventure'], ['loot', 'loot-and-rewards'],
	['trade', 'trade'], ['progression', 'character-progression'],
	['map', 'advice-for-the-game-master'],
];

function sourceContent(html) {
	const start = html.indexOf(sourceStart);
	const end = html.indexOf(sourceEnd);
	assert.ok(start >= 0 && end > start, 'The edition must identify its complete canonical content.');
	return html.slice(start + sourceStart.length, end);
}

function normalizedText(html) {
	return plainText(html).replace(/\s+/g, ' ').trim();
}

function semanticTags(html) {
	const meaningful = /^(?:h[1-6]|p|strong|em|u|code|pre|ul|ol|li|blockquote|hr|table|thead|tbody|tr|th|td)$/;
	return [...html.matchAll(/<(\/?)([a-z][a-z0-9]*)\b[^>]*>/gi)].filter(match => meaningful.test(match[2])).map(match => `${match[1]}${match[2]}`);
}

for (const [language, { sourcePath, outputPath }] of Object.entries(editions)) {
	test(language + ': published HTML retains all source text and semantic formatting in source order', async () => {
		const source = await fs.readFile(sourcePath, 'utf8');
		const { markdown } = await createRenderer();
		const canonical = markdown.parse(source);
		const html = await fs.readFile(outputPath, 'utf8');
		const book = sourceContent(html);
		assert.equal(normalizedText(book), normalizedText(canonical));
		assert.deepEqual(semanticTags(book), semanticTags(canonical));
		assert.deepEqual([...book.matchAll(/<span\b[^>]*>/g)].map(match => match[0]), [...canonical.matchAll(/<span\b[^>]*>/g)].map(match => match[0]));
		const hash = createHash('sha256').update(await fs.readFile(sourcePath)).digest('hex');
		assert.ok(html.includes(`name="rulebook-source-sha256" content="${hash}"`), 'Rebuild the HTML after an authorized source revision.');
	});

	test(language + ': all source hyperlinks retain their destinations, and every local destination exists exactly once', async () => {
		const source = await fs.readFile(sourcePath, 'utf8');
		const { markdown } = await createRenderer();
		const canonical = markdown.parse(source);
		const html = await fs.readFile(outputPath, 'utf8');
		const book = sourceContent(html);
		const hrefs = value => [...value.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map(match => match[1]);
		assert.deepEqual(hrefs(book), hrefs(canonical));
		const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
		assert.equal(new Set(ids).size, ids.length, 'Duplicate IDs break unambiguous navigation.');
		for (const href of hrefs(html).filter(value => value.startsWith('#'))) assert.ok(ids.includes(decodeURIComponent(href.slice(1))), `Missing target: ${href}`);
		for (const anchor of [...canonical.matchAll(/<a id="([^"]+)"/g)]) assert.ok(book.includes(`<a id="${anchor[1]}"`));
	});

	test(language + ': the standalone edition embeds every artwork and font and loads no remote runtime resources', async () => {
		const html = await fs.readFile(outputPath, 'utf8');
		const placements = [];
		let section;
		for (const match of sourceContent(html).matchAll(/<h[123] id="([^"]+)"|data-artwork="([^"]+)"/g)) {
			if (match[1]) section = match[1];
			else placements.push([match[2], section]);
		}
		assert.deepEqual(placements, illustratedSections.map(([name, id]) => [name, editions[language].ids[id] || id]));
		assert.equal([...html.matchAll(/<img src="data:image\/webp;base64,/g)].length, illustratedSections.length);
		assert.equal([...html.matchAll(/src: url\("data:font\/ttf;base64,/g)].length, 3);
		assert.doesNotMatch(html, /<(?:script|iframe)\b[^>]*\bsrc\s*=|<link\b[^>]*\bhref\s*=/i);
		assert.doesNotMatch(html, /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/);
		assert.doesNotMatch(html, /url\(["']?https?:\/\/|@import\b/);
		assert.ok(html.includes('SIL OPEN FONT LICENSE'));
		assert.doesNotMatch(html, /__BOOK__|__STYLES__|__FONT_|__READER__|__READER_UI__/);
		assert.ok(html.includes(`<html lang="${language}">`));
		for (const match of html.matchAll(/<img src="data:image\/webp;base64,([^"]+)"[^>]*data-artwork="([^"]+)"/g)) {
			assert.deepEqual(Buffer.from(match[1], 'base64'), await fs.readFile(path.resolve(__dirname, `../media/rulebook/${match[2]}.webp`)));
		}
	});

	test(language + ': rebuilding the source groups preserves the complete book independently of the published layout', async () => {
		const source = await fs.readFile(sourcePath, 'utf8');
		const { book, canonical, headings } = await renderBook(source, { illustrations: false, language });
		assert.equal(normalizedText(book), normalizedText(canonical));
		assert.deepEqual(semanticTags(book), semanticTags(canonical));
		assert.equal(headings.length, [...source.matchAll(/^#{1,6} /gm)].length);
		assert.ok(headings.some(heading => heading.id === (language === 'en' ? 'penalties--bonuses' : 'malus--bonus')));
		assert.ok(headings.some(heading => heading.id === (language === 'en' ? 'example-fire-rule-level-1' : 'exemple--loi-de-feu-niveau-1')));
	});
}

test('both editions share identical styles and reader behavior apart from localized identifiers and interface data', async () => {
	const english = await fs.readFile(editions.en.outputPath, 'utf8');
	const french = await fs.readFile(editions.fr.outputPath, 'utf8');
	let frenchStyles = french.match(/<style>([\s\S]*?)<\/style>/)[1];
	for (const [englishId, frenchId] of Object.entries(editions.fr.ids)) frenchStyles = frenchStyles.replaceAll(`="${frenchId}"`, `="${englishId}"`);
	assert.equal(frenchStyles, english.match(/<style>([\s\S]*?)<\/style>/)[1]);
	const reader = html => html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/const ui = .*?;/, 'const ui = {};');
	assert.equal(reader(french), reader(english));
	assert.ok(french.includes('Rechercher des mots ou des expressions'));
	assert.ok(french.includes('Chapitre précédent'));
	assert.ok(french.includes('id="niveaux-de-rareté"'));
});

test('every illustration retains reference history and verifies its current original and web copy', async () => {
	const directory = path.resolve(__dirname, '../media/rulebook');
	const manifest = JSON.parse(await fs.readFile(path.join(directory, 'artwork.json'), 'utf8'));
	assert.equal(manifest.tool, 'image_gen.imagegen');
	assert.deepEqual(manifest.artworks.map(art => art.name).sort(), illustratedSections.map(([name]) => name).sort());
	for (const art of manifest.artworks) {
		assert.ok(art.prompt.length > 500);
		assert.ok(Array.isArray(art.references) && art.references.length >= 1);
		assert.ok(art.references.every(reference => reference.path.startsWith('media/references/') && /^[a-f0-9]{64}$/.test(reference.sha256)));
		for (const file of [art.original, art.web]) {
			const bytes = await fs.readFile(path.join(directory, file.path));
			assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
		}
		const original = await fs.readFile(path.join(directory, art.original.path));
		assert.equal(original.readUInt32BE(16), art.width, `${art.name}: intrinsic width must match the current PNG.`);
		assert.equal(original.readUInt32BE(20), art.height, `${art.name}: intrinsic height must match the current PNG.`);
	}
});

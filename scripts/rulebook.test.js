const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { test } = require('node:test');
const { createRenderer, renderBook, sourcePath, outputPath, sourceStart, sourceEnd, plainText } = require('../documentation/rulebook/build');

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

test('published English HTML retains all source text and semantic formatting in source order', async () => {
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

test('all source hyperlinks retain their destinations, and every local destination exists exactly once', async () => {
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

test('the standalone edition embeds every artwork and font and loads no remote runtime resources', async () => {
	const html = await fs.readFile(outputPath, 'utf8');
	const art = [...html.matchAll(/data-artwork="([^"]+)"/g)].map(match => match[1]);
	assert.deepEqual(art, ['cover', 'characters', 'combat', 'runes', 'camp']);
	assert.equal([...html.matchAll(/<img src="data:image\/webp;base64,/g)].length, 5);
	assert.equal([...html.matchAll(/src: url\("data:font\/ttf;base64,/g)].length, 3);
	assert.doesNotMatch(html, /<(?:script|iframe)\b[^>]*\bsrc\s*=|<link\b[^>]*\bhref\s*=/i);
	assert.doesNotMatch(html, /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/);
	assert.doesNotMatch(html, /url\(["']?https?:\/\/|@import\b/);
	assert.ok(html.includes('SIL OPEN FONT LICENSE'));
	assert.doesNotMatch(html, /__BOOK__|__STYLES__|__FONT_|__READER__/);
});

test('rebuilding the source groups preserves the complete book independently of the published layout', async () => {
	const source = await fs.readFile(sourcePath, 'utf8');
	const { book, canonical, headings } = await renderBook(source, { illustrations: false });
	assert.equal(normalizedText(book), normalizedText(canonical));
	assert.deepEqual(semanticTags(book), semanticTags(canonical));
	assert.equal(headings.length, [...source.matchAll(/^#{1,6} /gm)].length);
	assert.ok(headings.some(heading => heading.id === 'penalties--bonuses'));
	assert.ok(headings.some(heading => heading.id === 'example-fire-rule-level-1'));
});

test('every illustration records actual supplied reference inputs and a reusable original', async () => {
	const directory = path.resolve(__dirname, '../media/rulebook');
	const manifest = JSON.parse(await fs.readFile(path.join(directory, 'artwork.json'), 'utf8'));
	assert.equal(manifest.tool, 'image_gen.imagegen');
	assert.equal(manifest.artworks.length, 5);
	for (const art of manifest.artworks) {
		assert.ok(art.prompt.length > 500);
		assert.ok(art.references.length >= 2);
		assert.ok(art.references.every(reference => reference.path.startsWith('media/references/') && /^[a-f0-9]{64}$/.test(reference.sha256)));
		for (const file of [art.original, art.web]) {
			const bytes = await fs.readFile(path.join(directory, file.path));
			assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
		}
	}
});

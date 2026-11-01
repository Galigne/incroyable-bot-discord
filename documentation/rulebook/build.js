const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');

const root = path.resolve(__dirname, '../..');
const sourcePath = path.join(root, 'documentation/TTRPG_RANDOM_RULES_EN.md');
const outputPath = path.join(root, 'documentation/TTRPG_RANDOM_RULES_EN.html');
const artworkDirectory = path.join(root, 'media/rulebook');
const sourceStart = '<!-- rulebook-source:start -->';
const sourceEnd = '<!-- rulebook-source:end -->';

function escapeAttribute(value) {
	return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function plainText(html) {
	return html.replace(/<[^>]*>/g, '').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&#39;', '\'').replaceAll('&#x27;', '\'');
}

function slugify(value) {
	return plainText(value).toLowerCase().replace(/[^\p{L}\p{N}_ -]/gu, '').replace(/ /g, '-');
}

async function createRenderer() {
	const { Marked } = await import('./vendor/marked.mjs');
	const headings = [];
	const counts = new Map();
	const markdown = new Marked({ gfm: true, breaks: false });
	markdown.use({
		renderer: {
			heading({ tokens, depth }) {
				const inline = this.parser.parseInline(tokens);
				const base = slugify(inline);
				const count = counts.get(base) || 0;
				counts.set(base, count + 1);
				const id = count ? `${base}-${count}` : base;
				headings.push({ id, depth, label: plainText(inline) });
				return `<h${depth} id="${id}" tabindex="-1">${inline}</h${depth}>\n`;
			},
		},
	});
	return { markdown, headings };
}

async function imageElement(name, className) {
	const bytes = await fs.readFile(path.join(artworkDirectory, `${name}.webp`));
	return `<figure class="illustration ${className}" aria-hidden="true"><img src="data:image/webp;base64,${bytes.toString('base64')}" alt="" width="1536" height="1024" ${name === 'cover' ? 'fetchpriority="high"' : 'loading="eager"'} decoding="async" data-artwork="${name}"></figure>`;
}

function renderTopics(tokens, markdown, chapterId) {
	const groups = [];
	let current = { id: `${chapterId}-introduction`, tokens: [] };
	for (const token of tokens) {
		const isHeading = token.type === 'heading';
		const anchor = chapterId === 'definitions' && token.raw.match(/^<a id="([^"]+)"><\/a>/);
		if (isHeading || anchor) {
			if (current.tokens.some(part => part.type !== 'space')) groups.push(current);
			current = { id: isHeading ? slugify(token.text) : anchor[1], tokens: [] };
		}
		current.tokens.push(token);
	}
	if (current.tokens.some(part => part.type !== 'space')) groups.push(current);
	return groups.map(group => `<div class="topic" data-topic="${group.id}">${markdown.parser(group.tokens)}</div>`).join('\n');
}

function navigation(headings) {
	const chapters = headings.filter(heading => heading.depth === 1 && !['ttrpg-random', 'table-of-contents'].includes(heading.id));
	return chapters.map((chapter, index) => {
		const first = headings.indexOf(chapter) + 1;
		const next = headings.findIndex((heading, position) => position >= first && heading.depth === 1);
		const children = headings.slice(first, next === -1 ? undefined : next);
		const label = `<span class="nav-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><a href="#${chapter.id}" data-chapter-link="${chapter.id}">${escapeAttribute(chapter.label)}</a>`;
		if (!children.length) return `<div class="nav-chapter nav-leaf">${label}</div>`;
		return `<details class="nav-chapter" data-chapter-nav="${chapter.id}"><summary>${label}<span class="disclosure" aria-hidden="true"></span></summary><ul>${children.map(child => `<li class="nav-depth-${child.depth}"><a href="#${child.id}">${escapeAttribute(child.label)}</a></li>`).join('')}</ul></details>`;
	}).join('\n');
}

async function renderBook(source, { illustrations = true } = {}) {
	const { markdown, headings } = await createRenderer();
	const tokens = markdown.lexer(source);
	const contentsIndex = tokens.findIndex(token => token.type === 'heading' && token.depth === 1 && token.text === 'Table of Contents');
	if (contentsIndex < 0) throw new Error('The canonical source must contain its table of contents.');
	const front = tokens.slice(0, contentsIndex);
	const firstRule = front.findIndex(token => token.type === 'hr');
	const lastRule = front.findLastIndex(token => token.type === 'hr');
	const image = async (name, className) => illustrations ? imageElement(name, className) : '';
	const cover = `<header class="book-cover" aria-labelledby="ttrpg-random">
<div class="front-meta">${markdown.parser(front.slice(0, firstRule))}</div>
<div class="cover-top-rule">${markdown.parser(front.slice(firstRule, firstRule + 1))}</div>
<div class="cover-title">${markdown.parser(front.slice(firstRule + 1, lastRule))}</div>
${await image('cover', 'cover-art')}
<div class="cover-bottom-rule">${markdown.parser(front.slice(lastRule))}</div>
</header>`;
	const chapters = [];
	for (const token of tokens.slice(contentsIndex)) {
		if (token.type === 'heading' && token.depth === 1) chapters.push({ title: token, tokens: [] });
		else chapters.at(-1).tokens.push(token);
	}
	const rendered = [];
	for (const [index, chapter] of chapters.entries()) {
		const id = slugify(chapter.title.text);
		const title = markdown.parser([chapter.title]);
		let body = renderTopics(chapter.tokens, markdown, id);
		if (id === 'combat') {
			body = body.replace('<div class="topic" data-topic="enchantments-and-runes">', '<div class="topic illustrated-topic" data-topic="enchantments-and-runes">');
			body = body.replace(/(<h2 id="enchantments-and-runes"[^>]*>.*?<\/h2>\n)/, `$1${await image('runes', 'rune-art')}`);
		}
		const openingArt = { 'character-creation': 'characters', combat: 'combat', adventure: 'camp' }[id];
		const art = openingArt ? await image(openingArt, 'chapter-art') : '';
		rendered.push(`<section class="chapter ${id === 'table-of-contents' ? 'contents' : ''}" data-chapter="${id}" aria-labelledby="${id}"><header class="chapter-heading" ${index ? `data-number="${String(index).padStart(2, '0')}"` : ''}>${title}</header>${art}<div class="chapter-body">${body}</div></section>`);
	}
	return { book: `${cover}\n${rendered.join('\n')}`, headings, navigation: navigation(headings), canonical: (await createRenderer()).markdown.parse(source) };
}

async function build() {
	const bytes = await fs.readFile(sourcePath);
	const source = bytes.toString('utf8');
	const { book, navigation: nav } = await renderBook(source);
	const [template, styles, reader, fonts] = await Promise.all([
		fs.readFile(path.join(__dirname, 'template.html'), 'utf8'),
		fs.readFile(path.join(__dirname, 'rulebook.css'), 'utf8'),
		fs.readFile(path.join(__dirname, 'reader.js'), 'utf8'),
		Promise.all(['EBGaramond', 'EBGaramond-Italic', 'Cinzel'].map(async name => [name, (await fs.readFile(path.join(__dirname, `fonts/${name}.ttf`))).toString('base64')])),
	]);
	let css = styles;
	for (const [name, base64] of fonts) css = css.replace(`__FONT_${name}__`, `data:font/ttf;base64,${base64}`);
	const hash = createHash('sha256').update(bytes).digest('hex');
	const licenses = (await Promise.all(['EBGaramond-OFL.txt', 'Cinzel-OFL.txt'].map(name => fs.readFile(path.join(__dirname, `fonts/${name}`), 'utf8')))).join('\n\n');
	const html = template.replace('__SOURCE_SHA256__', hash).replace('__FONT_LICENSES__', licenses.replaceAll('--', '—')).replace('__STYLES__', css).replace('__NAVIGATION__', nav).replace('__BOOK__', `${sourceStart}\n${book}\n${sourceEnd}`).replace('__READER__', reader);
	await fs.writeFile(outputPath, html);
	console.log(`Built documentation/TTRPG_RANDOM_RULES_EN.html (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MiB). Source SHA-256: ${hash}`);
	return { outputPath, hash };
}

if (require.main === module) {
	build().catch(error => {
		console.error(error);
		process.exitCode = 1;
	});
}

module.exports = { build, renderBook, createRenderer, sourcePath, outputPath, sourceStart, sourceEnd, plainText, slugify };

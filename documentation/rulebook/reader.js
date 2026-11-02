/* global document, window, NodeFilter, requestAnimationFrame, __READER_UI__ */
(() => {
	'use strict';
	const ui = __READER_UI__;
	const book = document.getElementById('rulebook');
	const sidebar = document.getElementById('chapter-navigation');
	const menu = document.getElementById('menu-toggle');
	const backdrop = document.getElementById('nav-backdrop');
	const dialog = document.getElementById('search-dialog');
	const input = document.getElementById('rule-search');
	const results = document.getElementById('search-results');
	const status = document.getElementById('search-status');
	const locationLabel = document.getElementById('current-location');
	const progress = document.getElementById('progress-fill');
	const chapters = [...book.querySelectorAll('[data-chapter]')];
	const headings = [...book.querySelectorAll('h1, h2, h3')];
	const mobile = window.matchMedia('(max-width: 880px)');
	const normalize = text => text.replace(/\s+/g, ' ').trim();
	let previousFocus;
	let highlighted;
	let highlightedTimer;
	let framePending = false;
	let currentChapter;
	const index = [...book.querySelectorAll('.chapter:not(.contents) .topic')].map(topic => {
		const chapter = topic.closest('[data-chapter]');
		const heading = topic.querySelector('h2, h3, a[id]');
		const title = heading?.tagName === 'A' ? heading.parentElement.querySelector('u')?.textContent : heading?.textContent;
		const text = normalize(topic.textContent);
		const titleElement = heading?.tagName === 'A' ? heading.parentElement : heading;
		const excerpt = normalize([...topic.childNodes].filter(node => node !== titleElement).map(node => node.textContent).join(' '));
		return {
			topic,
			id: heading?.id || chapter.dataset.chapter,
			title: normalize(title || chapter.querySelector('h1').textContent),
			chapter: chapter.querySelector('h1').textContent,
			text,
			excerpt,
			lower: text.toLocaleLowerCase(ui.language),
		};
	});

	function setMenu(open, restoreFocus = true) {
		document.body.classList.toggle('nav-open', open);
		menu.setAttribute('aria-expanded', String(open));
		backdrop.hidden = !open;
		if (mobile.matches) {
			book.inert = open;
			if (open) sidebar.querySelector('a').focus();
			else if (restoreFocus) menu.focus();
		}
	}

	function closeSearch() {
		dialog.close();
	}

	function openSearch() {
		setMenu(false, false);
		previousFocus = document.activeElement;
		dialog.showModal();
		input.focus();
		input.select();
	}

	function appendHighlighted(element, text, query) {
		const lower = text.toLocaleLowerCase(ui.language);
		let start = 0;
		let next = lower.indexOf(query);
		while (next !== -1) {
			element.append(document.createTextNode(text.slice(start, next)));
			const mark = document.createElement('mark');
			mark.textContent = text.slice(next, next + query.length);
			element.append(mark);
			start = next + query.length;
			next = lower.indexOf(query, start);
		}
		element.append(document.createTextNode(text.slice(start)));
	}

	function search() {
		const query = normalize(input.value).toLocaleLowerCase(ui.language);
		results.replaceChildren();
		if (!query) {
			status.textContent = ui.idle;
			return;
		}
		const matches = index.filter(entry => entry.lower.includes(query)).sort((left, right) => Number(right.title.toLocaleLowerCase(ui.language).includes(query)) - Number(left.title.toLocaleLowerCase(ui.language).includes(query)));
		status.textContent = matches.length ? `${matches.length} ${matches.length === 1 ? ui.singular : ui.plural}` : ui.none;
		for (const entry of matches) {
			const item = document.createElement('li');
			const link = document.createElement('a');
			link.href = `#${entry.id}`;
			const trail = document.createElement('span');
			trail.className = 'result-trail';
			trail.textContent = entry.chapter;
			const title = document.createElement('span');
			title.className = 'result-title';
			appendHighlighted(title, entry.title, query);
			const excerpt = document.createElement('span');
			excerpt.className = 'result-excerpt';
			const position = Math.max(0, entry.excerpt.toLocaleLowerCase(ui.language).indexOf(query));
			const start = Math.max(0, position - 65);
			const end = Math.min(entry.excerpt.length, position + query.length + 130);
			appendHighlighted(excerpt, `${start ? '…' : ''}${entry.excerpt.slice(start, end)}${end < entry.excerpt.length ? '…' : ''}`, query);
			link.append(trail, title, excerpt);
			link.addEventListener('click', () => {
				closeSearch();
				window.setTimeout(() => locate(entry.id, entry.topic, query), 0);
			});
			item.append(link);
			results.append(item);
		}
	}

	function clearHighlights() {
		if (!highlighted) return;
		highlighted.classList.remove('search-destination');
		for (const mark of highlighted.querySelectorAll('mark[data-search-mark]')) mark.replaceWith(document.createTextNode(mark.textContent));
		highlighted.normalize();
		highlighted = undefined;
	}

	function locate(id, topic, query) {
		clearHighlights();
		window.clearTimeout(highlightedTimer);
		const target = document.getElementById(id);
		if (!target) return;
		const destination = target.matches('a[id]') ? target.parentElement : target;
		destination.setAttribute('tabindex', '-1');
		destination.focus({ preventScroll: true });
		destination.scrollIntoView({ block: 'start' });
		if (!topic) return;
		highlighted = topic;
		topic.classList.add('search-destination');
		const walker = document.createTreeWalker(topic, NodeFilter.SHOW_TEXT);
		const nodes = [];
		while (walker.nextNode()) nodes.push(walker.currentNode);
		for (const node of nodes) {
			if (!node.textContent.toLocaleLowerCase(ui.language).includes(query)) continue;
			const fragment = document.createDocumentFragment();
			appendHighlighted(fragment, node.textContent, query);
			for (const mark of fragment.querySelectorAll('mark')) mark.dataset.searchMark = '';
			node.replaceWith(fragment);
		}
		highlightedTimer = window.setTimeout(clearHighlights, 12000);
	}

	function refreshPosition() {
		framePending = false;
		const offset = 100;
		let chapter;
		let active;
		for (const section of chapters) {
			if (section.getBoundingClientRect().top <= offset) chapter = section;
		}
		for (const heading of headings) {
			if (heading.getBoundingClientRect().top <= offset) active = heading;
		}
		const total = document.documentElement.scrollHeight - window.innerHeight;
		progress.style.width = `${total > 0 ? Math.min(100, Math.max(0, window.scrollY / total * 100)) : 0}%`;
		locationLabel.textContent = active?.textContent || ui.subtitle;
		for (const link of sidebar.querySelectorAll('a[aria-current]')) link.removeAttribute('aria-current');
		if (active) {
			const link = [...sidebar.querySelectorAll('a')].find(candidate => decodeURIComponent(candidate.hash) === `#${active.id}`);
			link?.setAttribute('aria-current', 'location');
		}
		if (chapter === currentChapter) return;
		currentChapter = chapter;
		if (chapter) {
			const nav = sidebar.querySelector(`[data-chapter-nav="${chapter.dataset.chapter}"]`);
			if (!mobile.matches) {
				for (const other of sidebar.querySelectorAll('details[open]')) if (other !== nav) other.open = false;
				if (nav) nav.open = true;
			}
		}
	}

	function queuePosition() {
		if (framePending) return;
		framePending = true;
		requestAnimationFrame(refreshPosition);
	}

	menu.hidden = false;
	menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') !== 'true'));
	backdrop.addEventListener('click', () => setMenu(false));
	sidebar.addEventListener('click', event => {
		const link = event.target.closest('a');
		if (!link) return;
		setMenu(false, false);
		window.setTimeout(() => locate(decodeURIComponent(link.hash.slice(1))), 0);
	});
	mobile.addEventListener('change', () => {
		setMenu(false, false);
		book.inert = false;
	});
	if (typeof dialog.showModal === 'function') {
		for (const trigger of document.querySelectorAll('.search-trigger')) {
			trigger.hidden = false;
			trigger.addEventListener('click', openSearch);
		}
	}
	input.addEventListener('input', search);
	document.getElementById('close-search').addEventListener('click', closeSearch);
	dialog.addEventListener('click', event => {
		if (event.target !== dialog) return;
		const bounds = dialog.getBoundingClientRect();
		if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeSearch();
	});
	dialog.addEventListener('close', () => previousFocus?.focus());
	dialog.addEventListener('keydown', event => {
		const links = [...results.querySelectorAll('a')];
		const focused = links.indexOf(document.activeElement);
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			if (!links.length) return;
			const step = event.key === 'ArrowDown' ? 1 : -1;
			const nextIndex = focused === -1 ? (step === 1 ? 0 : links.length - 1) : (focused + step + links.length) % links.length;
			links[nextIndex].focus();
		}
		if (event.key === 'Enter' && document.activeElement === input) {
			event.preventDefault();
			links[0]?.click();
		}
	});
	document.addEventListener('keydown', event => {
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && typeof dialog.showModal === 'function') {
			event.preventDefault();
			openSearch();
		}
		if (event.key === 'Escape' && document.body.classList.contains('nav-open')) setMenu(false);
		if (event.key === 'Tab' && document.body.classList.contains('nav-open')) {
			const focusable = [menu, ...sidebar.querySelectorAll('a, summary')].filter(element => element.getClientRects().length);
			const first = focusable[0];
			const last = focusable.at(-1);
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			}
			else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		}
	});
	window.addEventListener('scroll', queuePosition, { passive: true });
	window.addEventListener('resize', queuePosition, { passive: true });
	window.addEventListener('hashchange', queuePosition);
	window.addEventListener('load', refreshPosition);
	document.fonts.ready.then(() => {
		if (window.location.hash) locate(decodeURIComponent(window.location.hash.slice(1)));
		refreshPosition();
	});
	const pager = document.querySelector('.chapter-pager');
	const previous = document.getElementById('previous-chapter');
	const next = document.getElementById('next-chapter');
	const lastChapter = chapters.at(-2);
	previous.href = `#${lastChapter.dataset.chapter}`;
	previous.querySelector('strong').textContent = lastChapter.querySelector('h1').textContent;
	next.href = `#${ui.contentsId}`;
	next.querySelector('span').textContent = ui.back;
	next.querySelector('strong').textContent = ui.contents;
	pager.hidden = false;
})();

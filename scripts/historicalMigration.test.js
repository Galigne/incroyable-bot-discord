const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const generatorCatalog = require('../services/generatorCatalog');
const generatorResolver = require('../services/generatorResolver');
const { getEntryWeight } = require('../services/weightedSelector');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(
	path.join(root, 'documentation', 'JDR_RANDOM_OLD.md'),
	'utf8',
);
const manifest = JSON.parse(fs.readFileSync(
	path.join(root, 'documentation', 'JDR_RANDOM_OLD_MIGRATION_MANIFEST.json'),
	'utf8',
));
const lines = source.split(/\r?\n/);

const EXPECTED_SECTION_COUNTS = new Map([
	['Regions (`region`)', 17],
	['Settlements (`settlement`)', 10],
	['Adventure sites (`dungeon`)', 8],
	['Buildings (`building`)', 29],
	['Weapons (`weapons`)', 23],
	['Inventory (`inventory`)', 33],
	['Races (`race`)', 15],
	['Status effects (`status-effect`)', 5],
	['Events (`event`)', 16],
	['Personalities (`personality`)', 76],
	['RULEs (`rules`)', 45],
	['Animals (`animal`)', 10],
	['Monsters (`monster`)', 36],
	['Independent site modifiers', 11],
	['Independent monster modifiers', 12],
	['Quests (`quest`)', 25],
	['Historical statistics', 7],
	['Named historical NPC material', 3],
	['Historical NPC ages', 4],
	['Historical NPC professions and statuses', 64],
	['Historical criminals (`criminal`)', 4],
]);

const DIRECT_TARGETS = new Map([
	['Regions (`region`)', 'region'],
	['Settlements (`settlement`)', 'settlement'],
	['Adventure sites (`dungeon`)', 'dungeon'],
	['Buildings (`building`)', 'building'],
	['Weapons (`weapons`)', 'weapons'],
	['Inventory (`inventory`)', 'inventory'],
	['Races (`race`)', 'race'],
	['Status effects (`status-effect`)', 'status-effect'],
	['Events (`event`)', 'event'],
	['Personalities (`personality`)', 'personality'],
	['RULEs (`rules`)', 'rules'],
	['Independent monster modifiers', 'modifier'],
	['Quests (`quest`)', 'quest'],
]);

function compact(value) {
	return value.replace(/\s+/g, ' ').trim();
}

function findSection(prefix, nextPrefix = '### ') {
	const start = lines.findIndex(line => line.startsWith(prefix));
	assert.notEqual(start, -1, `Missing historical source section ${prefix}.`);
	const end = lines.findIndex((line, index) => (
		index > start && line.startsWith(nextPrefix)
	));
	return lines.slice(start + 1, end < 0 ? lines.length : end);
}

function boldNames(prefix) {
	const body = findSection(prefix).join('\n');
	return [...body.matchAll(/^- \*\*(.+?)\*\* —/gm)].map(match => compact(match[1]));
}

function tableRows(prefix) {
	return findSection(prefix)
		.filter(line => /^\|.+\|$/.test(line))
		.map(line => line.slice(1, -1).split('|').map(compact))
		.slice(2);
}

function plainBullets(prefix, nextPrefix = '### ') {
	const entries = [];
	let current = null;
	for (const line of findSection(prefix, nextPrefix)) {
		if (line.startsWith('- ')) {
			if (current) entries.push(compact(current));
			current = line.slice(2);
		}
		else if (current && /^\s{2}/.test(line)) {
			current += ` ${line.trim()}`;
		}
		else if (current) {
			entries.push(compact(current));
			current = null;
		}
	}
	if (current) entries.push(compact(current));
	return entries;
}

function professionValues() {
	const start = lines.findIndex(line => line.startsWith('#### M'));
	const end = lines.findIndex((line, index) => index > start && line.startsWith('### '));
	const body = lines.slice(start + 1, end).join(' ').replace(/\s+/g, ' ');
	const values = [];
	for (const match of body.matchAll(/- \*\*(.+?):\*\* (.+?)(?= - \*\*|$)/g)) {
		const group = compact(match[1]);
		for (const role of match[2].replace(/\.$/, '').split(/, | et /).map(compact)) {
			values.push(`${group}: ${role}`);
		}
	}
	return values;
}

function expectedSourceValues() {
	return new Map([
		['Regions (`region`)', boldNames('### R')],
		['Settlements (`settlement`)', boldNames('### Communaut')],
		['Adventure sites (`dungeon`)', boldNames('### Sites')],
		['Buildings (`building`)', boldNames('### B')],
		['Weapons (`weapons`)', tableRows('### Armes').map(row => row[0])],
		['Inventory (`inventory`)', tableRows('### Inventaire').map(row => row[0])],
		['Races (`race`)', tableRows('### Races').map(row => row[0])],
		['Status effects (`status-effect`)', boldNames('### Effets')],
		['Events (`event`)', boldNames(`### ${String.fromCodePoint(201)}v`)],
		['Personalities (`personality`)', tableRows('### Personnalit').map(row => row[0])],
		['RULEs (`rules`)', tableRows('### LOIs').map(row => row[0])],
		['Animals (`animal`)', boldNames('### Animaux')],
		['Monsters (`monster`)', boldNames('### Monstres')],
		['Independent site modifiers', tableRows('### Modificateurs de site').map(row => row[0])],
		['Independent monster modifiers', tableRows('### Modificateurs de monstre').map(row => row[0])],
		['Quests (`quest`)', plainBullets('### Qu', '## ')],
		['Historical statistics', tableRows('## Anciennes statistiques').map(row => row[0])],
		['Named historical NPC material', tableRows('### PNJ').map(row => row[0])],
		['Historical NPC ages', plainBullets('#### ', '#### M')],
		['Historical NPC professions and statuses', professionValues()],
		['Historical criminals (`criminal`)', boldNames('### Criminels')],
	]);
}

function assertCatalogEntry(generatorId, entryId, expectedWeight) {
	for (const locale of ['en', 'fr']) {
		const generator = generatorCatalog.getGenerator(generatorId, locale);
		assert.ok(generator, `Missing ${locale} generator ${generatorId}.`);
		const entry = generator.entries.find(candidate => candidate.id === entryId);
		assert.ok(entry, `Missing ${locale} migrated entry ${generatorId}:${entryId}.`);
		if (expectedWeight !== undefined) {
			assert.equal(
				getEntryWeight(entry),
				expectedWeight,
				`Historical weight drifted for ${locale} ${generatorId}:${entryId}.`,
			);
		}
	}
}

test('historical migration manifest accounts for every source item exactly once', () => {
	assert.equal(manifest.source, 'documentation/JDR_RANDOM_OLD.md');
	assert.equal(manifest.status, 'applied');
	assert.deepEqual(manifest.unresolvedDecisions, []);
	assert.equal(manifest.sections.length, EXPECTED_SECTION_COUNTS.size);
	const sourceValues = expectedSourceValues();
	let total = 0;
	for (const section of manifest.sections) {
		assert.equal(section.entries.length, EXPECTED_SECTION_COUNTS.get(section.sourceSection));
		assert.deepEqual(
			section.entries.map(entry => entry.sourceValue),
			sourceValues.get(section.sourceSection),
			`Historical source coverage changed for ${section.sourceSection}.`,
		);
		for (const entry of section.entries) {
			assert.match(entry.stableId, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
			assert.ok(['add', 'merge', 'replace', 'rewrite', 'split', 'reject'].includes(entry.action));
			assert.ok(Number.isFinite(entry.weight) && entry.weight > 0);
			assert.equal(entry.unresolved, null);
			if (entry.currentConflict) assert.ok(entry.conflictRationale);
			if (entry.action === 'reject') assert.equal(entry.winningContent, 'none');
			total += 1;
		}
	}
	assert.equal(total, 453);
});

test('every applied manifest disposition reaches its final catalog target', () => {
	for (const section of manifest.sections) {
		const directTarget = DIRECT_TARGETS.get(section.sourceSection);
		for (const entry of section.entries) {
			if (entry.action === 'reject') continue;
			if (directTarget) {
				assertCatalogEntry(directTarget, entry.stableId, entry.weight);
				continue;
			}
			if (section.sourceSection === 'Animals (`animal`)') {
				assertCatalogEntry(
					`creature-${entry.creature.classification}`,
					entry.stableId,
					entry.weight,
				);
				continue;
			}
			if (section.sourceSection === 'Monsters (`monster`)') {
				assertCatalogEntry('creature-monster', entry.stableId, entry.weight);
				continue;
			}
			for (const reference of entry.references) {
				if (reference.targetGenerator) {
					assertCatalogEntry(
						reference.targetGenerator,
						reference.entry ?? entry.stableId,
						entry.weight,
					);
				}
			}
		}
	}
	for (const disposition of manifest.currentCatalogDispositions) {
		for (const target of disposition.targets) {
			assertCatalogEntry(
				target,
				disposition.sourceEntryId === 'sir-candlewick'
					? 'sir-candlewick'
					: `${disposition.sourceGenerator === 'criminal' ? 'decomposed-criminal' : 'decomposed'}-${disposition.sourceEntryId}`,
			);
		}
	}
});

test('final catalogs contain no complete NPC or criminal root and no obsolete behavior', () => {
	assert.equal(generatorCatalog.getGenerator('npc'), undefined);
	assert.equal(generatorCatalog.getGenerator('criminal'), undefined);
	const all = generatorCatalog.listGenerators('en', { visibility: 'all' });
	const serialized = JSON.stringify(all);
	assert.doesNotMatch(serialized, /"generator":"(?:npc|criminal)"/);
	assert.doesNotMatch(serialized, /"Encumbrance"/i);
	assert.doesNotMatch(serialized, /challengeRating|fixedStatistics|statOverrides/);
	for (const modifier of all.filter(generator => generator.kind === 'modifier')) {
		assert.ok(modifier.visibility === 'internal');
		assert.ok(modifier.entries.every(entry => (
			Object.keys(entry).every(key => ['id', 'weight', 'fields'].includes(key))
		)));
	}
	for (const locale of ['en', 'fr']) {
		const quest = generatorCatalog.getGenerator('quest', locale);
		assert.equal(quest.kind, 'template');
		assert.ok(quest.entries.every(entry => (
			Object.values(entry.references).every(reference => (
				reference.generator !== 'npc' && reference.generator !== 'criminal'
			))
		)));
	}
});

test('every migrated quest resolves all role-oriented references with provenance', () => {
	for (const locale of ['en', 'fr']) {
		const quests = generatorCatalog.getGenerator('quest', locale).entries;
		for (const quest of quests) {
			const result = generatorResolver.resolveReference(
				{ generator: 'quest', entry: quest.id, select: 'display' },
				locale,
				{ random: () => 0 },
			);
			assert.ok(result.value);
			assert.doesNotMatch(result.value, /\{\{|\}\}|undefined/);
			assert.ok(result.provenance.length > 1, `${locale}:${quest.id}`);
			assert.equal(result.provenance[0].generatorId, 'quest');
			assert.equal(result.provenance[0].entryId, quest.id);
		}
	}
});

test('migrated production catalogs preserve deterministic IDs across locales', () => {
	for (const english of generatorCatalog.listGenerators('en')) {
		for (const randomValue of [0, 0.37, 0.999999]) {
			const en = generatorResolver.generate(english.id, 'en', {
				random: () => randomValue,
			});
			const fr = generatorResolver.generate(english.id, 'fr', {
				random: () => randomValue,
			});
			assert.equal(en.entryId, fr.entryId, `${english.id}:${randomValue}`);
			assert.deepEqual(
				en.provenance.map(record => [record.generatorId, record.entryId]),
				fr.provenance.map(record => [record.generatorId, record.entryId]),
				`${english.id}:${randomValue}`,
			);
			assert.deepEqual(
				en.modifiers.map(modifier => modifier.entryId),
				fr.modifiers.map(modifier => modifier.entryId),
				`${english.id}:${randomValue}`,
			);
		}
	}
});

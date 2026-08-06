const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createGeneratorResolver } = require('../services/generatorResolver');
const { createModifierResolver } = require('../services/modifierResolver');
const { selectResolvedOutput } = require('../services/referenceResolver');
const {
	validateGeneratorDefinition,
	validateGeneratorPair,
	validateGeneratorRelationships,
} = require('../services/generatorSchema');
const { createGeneratedEmbed } = require('../util/generatorResponses');

test('nested templates resolve random, fixed, weighted, and display references with provenance', () => {
	const catalogs = createLocalizedCatalogs();
	const resolver = createFixtureResolver(catalogs);
	const result = resolver.generate('quest', 'en', {
		random: sequenceRandom([0, 0, 0.8, 0, 0, 0, 0.9]),
	});

	assert.equal(result.generatorId, 'quest');
	assert.equal(result.generatorName, 'Quests');
	assert.equal(result.entryId, 'recover-before-rival');
	assert.equal(result.outputType, 'template');
	assert.equal(
		result.templateOutput,
		'Recover Relic from Harbor before Criminal meets the Criminal.',
	);
	assert.deepEqual(
		result.provenance.map(provenanceIdentity),
		[
			'entry:random:quest:recover-before-rival',
			'entry:random:item:relic',
			'generator-source:weighted:site-b:',
			'entry:random:site-b:harbor',
			'entry:fixed:person:criminal',
			'entry:random:nested-role:meeting',
			'entry:fixed:person:criminal',
		],
	);
	assert.deepEqual(result.modifiers.map(modifier => modifier.entryId), ['enraged']);
	assert.deepEqual(
		result.modifiers[0].provenance.map(provenanceIdentity),
		['entry:random:quest-modifier:enraged'],
	);
});

test('equivalent deterministic input selects the same IDs across locales', () => {
	const catalogs = createLocalizedCatalogs();
	const resolver = createFixtureResolver(catalogs);
	const randomValues = [0, 0, 0.8, 0, 0, 0, 0.9];
	const english = resolver.generate('quest', 'en', {
		random: sequenceRandom(randomValues),
	});
	const french = resolver.generate('quest', 'fr', {
		random: sequenceRandom(randomValues),
	});

	assert.notEqual(english.templateOutput, french.templateOutput);
	assert.equal(
		french.templateOutput,
		'Récupérez Relique au Port avant que Criminel ne rencontre le personnage Criminel.',
	);
	assert.deepEqual(
		english.provenance.map(provenanceIdentity),
		french.provenance.map(provenanceIdentity),
	);
	assert.deepEqual(
		english.modifiers.map(modifier => [modifier.generatorId, modifier.entryId]),
		french.modifiers.map(modifier => [modifier.generatorId, modifier.entryId]),
	);
	assert.equal(english.modifiers[0].name, 'Enraged');
	assert.equal(french.modifiers[0].name, 'Furieux');
});

test('fixed references do not consume randomness for entry selection', () => {
	const calls = [];
	const catalog = new Map([
		['person', createPersonGenerator('en')],
		['fixed-prompt', {
			schemaVersion: 2,
			id: 'fixed-prompt',
			kind: 'template',
			visibility: 'public',
			name: 'Fixed prompt',
			description: 'A fixed prompt',
			entrySchema: { type: 'template' },
			entries: [{
				id: 'fixed-role',
				template: 'Meet {{role}}',
				references: {
					role: {
						generator: 'person',
						entry: 'criminal',
						select: 'fields',
					},
				},
			}],
		}],
	]);
	const resolver = createGeneratorResolver({
		getGenerator: id => catalog.get(id),
	});
	const result = resolver.generate('fixed-prompt', 'en', {
		random: () => {
			calls.push('random');
			return 0;
		},
	});

	assert.equal(result.templateOutput, 'Meet Criminal — An outlaw.');
	assert.equal(calls.length, 1);
	assert.equal(result.provenance[1].selection, 'fixed');
});

test('selectors return values, complete field groups, individual fields, and displays', () => {
	const valueResult = {
		outputType: 'value',
		value: 'Rain',
		display: 'Rain',
	};
	const fieldsResult = {
		outputType: 'fields',
		fields: { Name: 'Criminal', Description: 'An outlaw.' },
		display: 'Criminal',
	};
	const templateResult = {
		outputType: 'template',
		templateOutput: 'A resolved quest.',
		display: 'A resolved quest.',
	};

	assert.equal(selectResolvedOutput(valueResult, 'value'), 'Rain');
	assert.equal(selectResolvedOutput(valueResult, 'display'), 'Rain');
	assert.deepEqual(selectResolvedOutput(fieldsResult, 'fields'), fieldsResult.fields);
	assert.notEqual(selectResolvedOutput(fieldsResult, 'fields'), fieldsResult.fields);
	assert.equal(selectResolvedOutput(fieldsResult, 'fields.Name'), 'Criminal');
	assert.equal(selectResolvedOutput(fieldsResult, 'display'), 'Criminal');
	assert.equal(selectResolvedOutput(templateResult, 'display'), 'A resolved quest.');
	assert.throws(
		() => selectResolvedOutput(valueResult, 'fields.Name'),
		error => error.code === 'INVALID_GENERATOR_SELECTOR',
	);
});

test('resolution reports stable cycle and bounded-depth errors', () => {
	const cycle = createCycleCatalog();
	const cycleResolver = createGeneratorResolver({
		getGenerator: id => cycle.get(id),
	});
	assert.throws(
		() => cycleResolver.generate('loop', 'en', { random: () => 0 }),
		error => error.code === 'GENERATOR_REFERENCE_CYCLE',
	);

	const chain = createDepthCatalog();
	const depthResolver = createGeneratorResolver({
		getGenerator: id => chain.get(id),
	});
	assert.throws(
		() => depthResolver.generate('chain', 'en', {
			random: () => 0,
			maxDepth: 2,
		}),
		error => error.code === 'GENERATOR_MAX_DEPTH_EXCEEDED',
	);
});

test('modifier chance, inclusive count, weighted uniqueness, and compatibility are enforced', () => {
	const catalogs = createLocalizedCatalogs();
	const english = catalogs.get('en');
	const resolver = createModifierResolver({
		getGenerator: id => english.get(id),
	});
	const request = {
		generator: 'quest-modifier',
		chance: 0.25,
		count: { min: 1, max: 1 },
	};
	let chanceCalls = 0;
	assert.deepEqual(
		resolver.resolveModifierRequests([request], 'quest', 'en', {
			random: () => {
				chanceCalls += 1;
				return 0.25;
			},
		}),
		[],
	);
	assert.equal(chanceCalls, 1);

	const records = resolver.resolveModifierRequests([{
		...request,
		chance: 1,
		count: { min: 1, max: 2 },
	}], 'quest', 'en', {
		random: sequenceRandom([0, 0.999999, 0, 0.999999]),
	});
	assert.equal(records.length, 2);
	assert.equal(new Set(records.map(record => record.entryId)).size, 2);
	assert.throws(
		() => resolver.resolveModifierRequests([{
			...request,
			chance: 1,
		}], 'item', 'en', { random: sequenceRandom([0]) }),
		error => error.code === 'GENERATOR_MODIFIER_INCOMPATIBLE',
	);
	assert.throws(
		() => resolver.resolveModifierRequests([{
			...request,
			generator: 'missing-modifier',
			chance: 0,
		}], 'quest', 'en', { random: sequenceRandom([0]) }),
		error => error.code === 'GENERATOR_MODIFIER_MISSING',
	);
});

test('descriptive modifiers attach without mutating the base resolved result', () => {
	const withModifierCatalogs = createLocalizedCatalogs();
	const withoutModifierCatalogs = createLocalizedCatalogs({ includeRequest: false });
	const withModifiers = createFixtureResolver(withModifierCatalogs).generate('quest', 'en', {
		random: sequenceRandom([0, 0, 0.8, 0, 0, 0, 0.9]),
	});
	const withoutModifiers = createFixtureResolver(withoutModifierCatalogs).generate(
		'quest',
		'en',
		{ random: sequenceRandom([0, 0, 0.8, 0, 0]) },
	);
	const { modifiers, ...baseWithModifiers } = withModifiers;
	const { modifiers: emptyModifiers, ...baseWithoutModifiers } = withoutModifiers;

	assert.equal(modifiers.length, 1);
	assert.deepEqual(emptyModifiers, []);
	assert.deepEqual(baseWithModifiers, baseWithoutModifiers);
});

test('template and modifier schemas enforce parity, relationships, and descriptive-only data', () => {
	const catalogs = createLocalizedCatalogs();
	for (const generator of catalogs.get('en').values()) {
		assert.equal(validateGeneratorDefinition(generator), generator);
		assert.equal(
			validateGeneratorPair(generator, catalogs.get('fr').get(generator.id)),
			true,
		);
	}
	assert.equal(validateGeneratorRelationships(catalogs.get('en')), true);

	const mismatchedTemplate = structuredClone(catalogs.get('fr').get('quest'));
	mismatchedTemplate.entries[0].template = 'Récupérez {{item}}.';
	assert.throws(
		() => validateGeneratorPair(catalogs.get('en').get('quest'), mismatchedTemplate),
		error => error.code === 'GENERATOR_TEMPLATE_REFERENCE_MISMATCH',
	);
	const mismatchedSource = structuredClone(catalogs.get('fr').get('quest'));
	mismatchedSource.entries[0].references.site.generator.oneOf[0].weight = 4;
	assert.throws(
		() => validateGeneratorPair(catalogs.get('en').get('quest'), mismatchedSource),
		error => error.code === 'GENERATOR_LOCALE_PARITY_MISMATCH',
	);
	const mismatchedChance = structuredClone(catalogs.get('fr').get('quest'));
	mismatchedChance.modifiers[0].chance = 0.5;
	assert.throws(
		() => validateGeneratorPair(catalogs.get('en').get('quest'), mismatchedChance),
		error => error.code === 'GENERATOR_LOCALE_PARITY_MISMATCH',
	);

	const mechanicalModifier = structuredClone(catalogs.get('en').get('quest-modifier'));
	mechanicalModifier.entries[0].mechanics = { strength: 2 };
	assert.throws(
		() => validateGeneratorDefinition(mechanicalModifier),
		error => error.code === 'INVALID_GENERATOR_STRUCTURE',
	);
	const mechanicalField = structuredClone(catalogs.get('en').get('quest-modifier'));
	mechanicalField.entrySchema.required.push('Effects');
	mechanicalField.entries.forEach(entry => {
		entry.fields.Effects = 'None';
	});
	assert.throws(
		() => validateGeneratorDefinition(mechanicalField),
		error => error.code === 'MODIFIER_MECHANICAL_FIELD',
	);
	const textModifier = structuredClone(catalogs.get('en').get('quest-modifier'));
	textModifier.entrySchema = { type: 'text' };
	textModifier.entries = [{ id: 'narrative', value: 'Narrative only' }];
	assert.throws(
		() => validateGeneratorDefinition(textModifier),
		error => error.code === 'INVALID_GENERATOR_ENTRY_SCHEMA',
	);
	for (const invalidRequest of [
		{ generator: 'quest-modifier', chance: 2, count: { min: 1, max: 1 } },
		{ generator: 'quest-modifier', chance: 1, count: { min: 2, max: 1 } },
	]) {
		const invalidQuest = structuredClone(catalogs.get('en').get('quest'));
		invalidQuest.modifiers = [invalidRequest];
		assert.throws(
			() => validateGeneratorDefinition(invalidQuest),
			error => [
				'INVALID_MODIFIER_CHANCE',
				'INVALID_MODIFIER_COUNT',
			].includes(error.code),
		);
	}
	const fixedWeightedSource = structuredClone(catalogs.get('en').get('quest'));
	fixedWeightedSource.entries[0].references.site.entry = 'harbor';
	assert.throws(
		() => validateGeneratorDefinition(fixedWeightedSource),
		error => error.code === 'INVALID_GENERATOR_FIXED_REFERENCE',
	);

	const missingSource = new Map(catalogs.get('en'));
	missingSource.delete('item');
	assert.throws(
		() => validateGeneratorRelationships(missingSource),
		error => error.code === 'GENERATOR_REFERENCE_MISSING',
	);
	const missingFixedEntry = new Map(catalogs.get('en'));
	const missingEntryQuest = structuredClone(missingFixedEntry.get('quest'));
	missingEntryQuest.entries[0].references.rival.entry = 'missing-role';
	missingFixedEntry.set('quest', missingEntryQuest);
	assert.throws(
		() => validateGeneratorRelationships(missingFixedEntry),
		error => error.code === 'GENERATOR_ENTRY_NOT_FOUND',
	);
	const invalidSelector = new Map(catalogs.get('en'));
	const invalidSelectorQuest = structuredClone(invalidSelector.get('quest'));
	invalidSelectorQuest.entries[0].references.item.select = 'value';
	invalidSelector.set('quest', invalidSelectorQuest);
	assert.throws(
		() => validateGeneratorRelationships(invalidSelector),
		error => error.code === 'INVALID_GENERATOR_SELECTOR',
	);

	const incompatible = new Map(catalogs.get('en'));
	const incompatibleModifier = structuredClone(incompatible.get('quest-modifier'));
	incompatibleModifier.appliesTo = ['item'];
	incompatible.set('quest-modifier', incompatibleModifier);
	assert.throws(
		() => validateGeneratorRelationships(incompatible),
		error => error.code === 'GENERATOR_MODIFIER_INCOMPATIBLE',
	);
});

test('/gen rendering preserves value and fields layouts and renders templates and modifiers', () => {
	const valueEmbed = createGeneratedEmbed({
		generatorName: 'Weather',
		entryId: 'rain',
		outputType: 'value',
		value: 'Rain begins.',
		provenance: [],
		modifiers: [],
	}).toJSON();
	assert.equal(valueEmbed.description, 'Rain begins.');

	const fieldsEmbed = createGeneratedEmbed({
		generatorName: 'People',
		entryId: 'criminal',
		outputType: 'fields',
		fields: { Name: 'Criminal', Description: 'An outlaw.' },
		provenance: [],
		modifiers: [],
	}).toJSON();
	assert.deepEqual(fieldsEmbed.fields.map(field => field.name), ['Name', 'Description']);

	const templateEmbed = createGeneratedEmbed({
		generatorName: 'Quests',
		entryId: 'recover',
		outputType: 'template',
		templateOutput: 'Recover the relic.',
		provenance: [],
		modifiers: [{
			generatorId: 'quest-modifier',
			entryId: 'urgent',
			name: 'Urgent',
			description: 'Time is running out.',
			provenance: [],
		}],
	}).toJSON();
	assert.equal(templateEmbed.description, 'Recover the relic.');
	assert.deepEqual(templateEmbed.fields, [{
		name: 'Modifiers',
		value: '**Urgent** — Time is running out.',
	}]);
});

function createLocalizedCatalogs({ includeRequest = true } = {}) {
	return new Map([
		['en', createFixtureCatalog('en', includeRequest)],
		['fr', createFixtureCatalog('fr', includeRequest)],
	]);
}

function createFixtureCatalog(locale, includeRequest) {
	const french = locale === 'fr';
	const quest = {
		schemaVersion: 2,
		id: 'quest',
		kind: 'template',
		visibility: 'public',
		name: french ? 'Quêtes' : 'Quests',
		description: french ? 'Amorces de quêtes' : 'Quest prompts',
		entrySchema: { type: 'template' },
		entries: [{
			id: 'recover-before-rival',
			weight: 2,
			template: french
				? 'Récupérez {{item}} au {{site}} avant que {{rival}} ne rencontre {{meeting}}.'
				: 'Recover {{item}} from {{site}} before {{rival}} meets {{meeting}}.',
			references: {
				item: { generator: 'item', select: 'fields.Name' },
				site: {
					generator: {
						oneOf: [
							{ id: 'site-a', weight: 3 },
							{ id: 'site-b', weight: 1 },
						],
					},
					select: 'display',
				},
				rival: {
					generator: 'person',
					entry: 'criminal',
					select: 'fields.Name',
				},
				meeting: { generator: 'nested-role', select: 'display' },
			},
		}],
	};
	if (includeRequest) {
		quest.modifiers = [{
			generator: 'quest-modifier',
			chance: 1,
			count: { min: 1, max: 1 },
		}];
	}
	return new Map([
		['person', createPersonGenerator(locale)],
		['item', createFieldsGenerator(
			'item',
			french ? 'Objets' : 'Items',
			french ? ['Relique', 'Registre'] : ['Relic', 'Ledger'],
		)],
		['site-a', createFieldsGenerator(
			'site-a',
			french ? 'Sites ruraux' : 'Rural sites',
			french ? ['Ruines'] : ['Ruins'],
		)],
		['site-b', createFieldsGenerator(
			'site-b',
			french ? 'Sites urbains' : 'Urban sites',
			french ? ['Port'] : ['Harbor'],
		)],
		['nested-role', createNestedRoleGenerator(locale)],
		['quest-modifier', createModifierGenerator(locale)],
		['quest', quest],
	]);
}

function createPersonGenerator(locale) {
	const french = locale === 'fr';
	return {
		schemaVersion: 2,
		id: 'person',
		kind: 'component',
		visibility: 'internal',
		name: french ? 'Personnes' : 'People',
		description: french ? 'Rôles de personnages' : 'Character roles',
		entrySchema: { type: 'fields', required: ['Name', 'Description'] },
		entries: [
			{
				id: 'criminal',
				fields: {
					Name: french ? 'Criminel' : 'Criminal',
					Description: french ? 'Un hors-la-loi.' : 'An outlaw.',
				},
			},
			{
				id: 'noble',
				fields: {
					Name: french ? 'Noble' : 'Noble',
					Description: french ? 'Un aristocrate.' : 'An aristocrat.',
				},
			},
		],
	};
}

function createFieldsGenerator(id, name, values) {
	return {
		schemaVersion: 2,
		id,
		kind: 'component',
		visibility: 'internal',
		name,
		description: name,
		entrySchema: { type: 'fields', required: ['Name'] },
		entries: values.map(value => ({
			id: value === 'Harbor' || value === 'Port'
				? 'harbor'
				: value === 'Ruins' || value === 'Ruines'
					? 'ruins'
					: value === 'Relic' || value === 'Relique'
						? 'relic'
						: 'ledger',
			fields: { Name: value },
		})),
	};
}

function createNestedRoleGenerator(locale) {
	const french = locale === 'fr';
	return {
		schemaVersion: 2,
		id: 'nested-role',
		kind: 'template',
		visibility: 'internal',
		name: french ? 'Rencontres' : 'Meetings',
		description: french ? 'Rencontres imbriquées' : 'Nested meetings',
		entrySchema: { type: 'template' },
		entries: [{
			id: 'meeting',
			template: french ? 'le personnage {{role}}' : 'the {{role}}',
			references: {
				role: {
					generator: 'person',
					entry: 'criminal',
					select: 'display',
				},
			},
		}],
	};
}

function createModifierGenerator(locale) {
	const french = locale === 'fr';
	return {
		schemaVersion: 2,
		id: 'quest-modifier',
		kind: 'modifier',
		visibility: 'internal',
		name: french ? 'Modificateurs de quête' : 'Quest modifiers',
		description: french ? 'Variantes descriptives' : 'Descriptive variants',
		appliesTo: ['quest'],
		entrySchema: { type: 'fields', required: ['Name', 'Description'] },
		entries: [
			{
				id: 'urgent',
				fields: {
					Name: french ? 'Urgent' : 'Urgent',
					Description: french
						? 'Le temps presse.'
						: 'Time is running out.',
				},
			},
			{
				id: 'enraged',
				weight: 2,
				fields: {
					Name: french ? 'Furieux' : 'Enraged',
					Description: french
						? 'Les tensions ont atteint leur paroxysme.'
						: 'Tensions have reached a breaking point.',
				},
			},
		],
	};
}

function createFixtureResolver(catalogs) {
	return createGeneratorResolver({
		getGenerator: (id, locale) => catalogs.get(locale).get(id),
	});
}

function createCycleCatalog() {
	return new Map([['loop', {
		schemaVersion: 2,
		id: 'loop',
		kind: 'template',
		visibility: 'public',
		name: 'Loop',
		description: 'Cyclic template',
		entrySchema: { type: 'template' },
		entries: [{
			id: 'again',
			template: '{{again}}',
			references: {
				again: {
					generator: 'loop',
					entry: 'again',
					select: 'display',
				},
			},
		}],
	}]]);
}

function createDepthCatalog() {
	const chain = {
		schemaVersion: 2,
		id: 'chain',
		kind: 'template',
		visibility: 'public',
		name: 'Chain',
		description: 'Deep template chain',
		entrySchema: { type: 'template' },
		entries: [
			createChainEntry('first', 'second'),
			createChainEntry('second', 'third'),
			{
				id: 'third',
				template: '{{ending}}',
				references: {
					ending: { generator: 'ending', select: 'value' },
				},
			},
		],
	};
	return new Map([
		['chain', chain],
		['ending', {
			schemaVersion: 2,
			id: 'ending',
			kind: 'component',
			visibility: 'internal',
			name: 'Ending',
			description: 'End of chain',
			entrySchema: { type: 'text' },
			entries: [{ id: 'done', value: 'Done' }],
		}],
	]);
}

function createChainEntry(id, nextEntry) {
	return {
		id,
		template: '{{next}}',
		references: {
			next: {
				generator: 'chain',
				entry: nextEntry,
				select: 'display',
			},
		},
	};
}

function sequenceRandom(values) {
	let index = 0;
	return () => values[index++] ?? 0;
}

function provenanceIdentity(entry) {
	return [
		entry.type,
		entry.selection,
		entry.generatorId,
		entry.entryId ?? '',
	].join(':');
}

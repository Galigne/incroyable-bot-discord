const assert = require('node:assert/strict');
const { test } = require('node:test');
const commandRegistry = require('../commands/registry');
const {
	generateGeneratorResults,
} = require('../services/generatorApplicationService');
const { createGeneratorResolver } = require('../services/generatorResolver');
const { selectResolvedOutput } = require('../services/referenceResolver');
const {
	validateGeneratorDefinition,
	validateGeneratorPair,
	validateGeneratorRelationships,
} = require('../services/generatorSchema');
const {
	createGeneratorBatchResponse,
	createGeneratedEmbed,
	createGeneratorResponse,
} = require('../util/generatorResponses');

test('generator batches call the single-result resolver independently', () => {
	const calls = [];
	const generated = { generatorId: 'fixture', entryId: 'same' };
	const results = generateGeneratorResults(
		'fixture',
		'en',
		{ count: 3 },
		{
			generate(...args) {
				calls.push(args);
				return generated;
			},
		},
	);

	assert.equal(results.length, 3);
	assert.deepEqual(results, [generated, generated, generated]);
	assert.equal(calls.length, 3);
	assert.deepEqual(calls, [
		['fixture', 'en', {}],
		['fixture', 'en', {}],
		['fixture', 'en', {}],
	]);
	for (const count of [0, 11, 1.5]) {
		assert.throws(
			() => generateGeneratorResults('fixture', 'en', { count }, {
				generate: () => generated,
			}),
			/Generator count must be an integer from 1 to 10/,
		);
	}
});

test('/gen count uses one embed per result while keeping modifiers with their result', () => {
	const results = Array.from({ length: 10 }, (_, index) => ({
		generatorName: 'Quest',
		outputType: index % 2 === 0 ? 'value' : 'fields',
		value: `Prompt ${index + 1}`,
		displayFields: { name: `Entry ${index + 1}` },
		modifiers: index === 0
			? [{
				generatorName: 'Quest modifiers',
				outputType: 'fields',
				displayFields: { name: 'Urgent', description: 'Act now.' },
				modifiers: [],
			}]
			: [],
	}));
	const response = createGeneratorBatchResponse(results, 'quest', 'en');

	assert.equal(response.embeds.length, 10);
	assert.deepEqual(response.embeds.map(embed => embed.data.title), [
		...Array.from({ length: 10 }, (_, index) => `Result ${index + 1}/10 — Quest`),
	]);
	assert.match(response.embeds[0].data.fields[0].name, /Generated modifier Quest modifiers/);
	assert.ok(response.embeds.every(embed => (
		(embed.data.fields ?? []).length <= 25
		&& (embed.data.fields ?? []).every(field => field.value.length <= 1_024)
	)));
});

test('/gen count is wired through the command runtime', async () => {
	let response;
	await commandRegistry.getRuntimeCommands().get('gen').execute({
		config: { locale: 'en' },
		interaction: {
			options: {
				getInteger: name => name === 'count' ? 2 : null,
				getString: (name, required) => {
					if (name === 'category') {
						return 'name';
					}
					if (required) {
						throw new Error(`Missing required option ${name}.`);
					}
					return null;
				},
			},
			reply: async payload => {
				response = payload;
			},
		},
	});

	assert.equal(response.embeds.length, 2);
	assert.match(response.embeds[0].data.title, /Result 1\/2/);
	assert.match(response.embeds[1].data.title, /Result 2\/2/);
});

test('inline references resolve text, structured display, explicit fields, and provenance', () => {
	const catalogs = createLocalizedCatalogs();
	const resolver = createFixtureResolver(catalogs);
	const result = resolver.generate('quest', 'en', {
		random: sequenceRandom([0, 0, 0]),
	});

	assert.equal(result.outputType, 'value');
	assert.equal(
		result.value,
		'Recover Relic from Outlaw — An outlaw at Relic — A valuable object.',
	);
	assert.deepEqual(
		result.provenance.map(provenanceIdentity),
		[
			'entry:random:quest:recover_item',
			'entry:random:item:relic',
			'entry:fixed:person:outlaw',
			'entry:random:item:relic',
		],
	);

	const fields = resolver.resolveReference(
		{ generator: 'item', entry: 'relic', select: 'fields' },
		'en',
	);
	assert.deepEqual(fields.value, {
		name: 'Relic',
		description: 'A valuable object',
	});
	assert.equal(
		resolver.resolveInlineReference('{{ item:relic.name }}', 'en').value,
		'Relic',
	);
	const inlineString = resolver.resolveInlineString(
		'Found {{ item:relic }} beneath the altar.',
		'en',
		{ random: () => 0 },
	);
	assert.equal(
		inlineString.value,
		'Found Relic — A valuable object beneath the altar.',
	);
	assert.equal(inlineString.provenance[0].entryId, 'relic');
});

test('/gen formats direct substitutions without changing the generated value', () => {
	const resolver = createInlineFormattingResolver(new Map([
		['quest', createTextGenerator('quest', 'Go to {{ city }}.')],
		['city', createTextGenerator('city', 'Waterdeep', 'internal')],
	]));
	const result = resolver.generate('quest', 'en', { random: () => 0 });

	assert.equal(result.value, 'Go to Waterdeep.');
	assert.equal(
		createGeneratedEmbed(result).toJSON().description,
		'Go to `Waterdeep`.',
	);
});

test('/gen brackets recursive substitutions inside the direct inline-code value', () => {
	const resolver = createInlineFormattingResolver(new Map([
		['quest', createTextGenerator('quest', 'Escort {{ background }} across a forest.')],
		['background', createTextGenerator('background', 'Merchant from {{ city }}')],
		['city', createTextGenerator('city', 'Waterdeep', 'internal')],
	]));
	const quest = resolver.generate('quest', 'en', { random: () => 0 });
	const background = resolver.generate('background', 'en', { random: () => 0 });

	assert.equal(quest.value, 'Escort Merchant from Waterdeep across a forest.');
	assert.equal(background.value, 'Merchant from Waterdeep');
	assert.equal(
		createGeneratedEmbed(quest).toJSON().description,
		'Escort `Merchant from [Waterdeep]` across a forest.',
	);
	assert.equal(
		createGeneratedEmbed(background).toJSON().description,
		'Merchant from `Waterdeep`',
	);
});

test('/gen formats multiple references independently in one template', () => {
	const resolver = createInlineFormattingResolver(new Map([
		['quest', createTextGenerator('quest', 'Meet {{ person }} at {{ city }}.')],
		['person', createTextGenerator('person', 'the Old Ranger', 'internal')],
		['city', createTextGenerator('city', 'Waterdeep', 'internal')],
	]));
	const result = resolver.generate('quest', 'en', { random: () => 0 });

	assert.equal(
		createGeneratedEmbed(result).toJSON().description,
		'Meet `the Old Ranger` at `Waterdeep`.',
	);
});

test('/gen brackets every level of deeper recursive substitutions', () => {
	const resolver = createInlineFormattingResolver(new Map([
		['outer', createTextGenerator('outer', 'A {{ middle }}')],
		['middle', createTextGenerator('middle', 'B {{ inner }}', 'internal')],
		['inner', createTextGenerator('inner', 'C {{ final }}', 'internal')],
		['final', createTextGenerator('final', 'D', 'internal')],
	]));
	const result = resolver.generate('outer', 'en', { random: () => 0 });

	assert.equal(result.value, 'A B C D');
	assert.equal(
		createGeneratedEmbed(result).toJSON().description,
		'A `B [C [D]]`',
	);
});

test('/gen applies the same substitution formatting to displayed generator fields', () => {
	const resolver = createInlineFormattingResolver(new Map([
		['person', {
			schemaVersion: 3,
			id: 'person',
			visibility: 'public',
			name: 'People',
			description: 'People',
			entrySchema: { type: 'fields', required: ['name', 'description'] },
			entries: [{
				id: 'merchant',
				fields: {
					name: 'Merchant from {{ city }}',
					description: 'A traveler.',
				},
			}],
		}],
		['city', createTextGenerator('city', 'Waterdeep', 'internal')],
	]));
	const result = resolver.generate('person', 'en', { random: () => 0 });
	const fields = createGeneratedEmbed(result).toJSON().fields;

	assert.equal(result.displayFields.name, 'Merchant from Waterdeep');
	assert.equal(
		fields.find(field => field.name === 'Name').value,
		'Merchant from `Waterdeep`',
	);
});

test('equivalent deterministic input preserves inline selection IDs across locales', () => {
	const catalogs = createLocalizedCatalogs();
	const resolver = createFixtureResolver(catalogs);
	const values = [0, 0.9, 0.1];
	const english = resolver.generate('quest', 'en', { random: sequenceRandom(values) });
	const french = resolver.generate('quest', 'fr', { random: sequenceRandom(values) });

	assert.notEqual(english.value, french.value);
	assert.deepEqual(
		english.provenance.map(provenanceIdentity),
		french.provenance.map(provenanceIdentity),
	);
});

test('fixed inline references do not consume randomness for entry selection', () => {
	const catalog = new Map([
		['person', createPersonGenerator('en')],
		['fixed_prompt', {
			schemaVersion: 3,
			id: 'fixed_prompt',
			visibility: 'public',
			name: 'Fixed prompt',
			description: 'A fixed prompt',
			entrySchema: { type: 'text' },
			entries: [{ id: 'fixed_role', value: 'Meet {{ person:outlaw }}.' }],
		}],
	]);
	const resolver = createGeneratorResolver({ getGenerator: id => catalog.get(id) });
	let calls = 0;
	const result = resolver.generate('fixed_prompt', 'en', {
		random: () => {
			calls += 1;
			return 0;
		},
	});

	assert.equal(result.value, 'Meet Outlaw — An outlaw.');
	assert.equal(calls, 1);
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
		fields: { name: 'Outlaw', description: 'An outlaw.' },
		selectedField: 'Outlaw',
		display: 'Outlaw — An outlaw.',
	};

	assert.equal(selectResolvedOutput(valueResult, 'value'), 'Rain');
	assert.equal(selectResolvedOutput(valueResult, 'display'), 'Rain');
	assert.deepEqual(selectResolvedOutput(fieldsResult, 'fields'), fieldsResult.fields);
	assert.notEqual(selectResolvedOutput(fieldsResult, 'fields'), fieldsResult.fields);
	assert.equal(selectResolvedOutput(fieldsResult, 'fields.name'), 'Outlaw');
	assert.equal(selectResolvedOutput(fieldsResult, 'display'), 'Outlaw — An outlaw.');
	assert.throws(
		() => selectResolvedOutput(valueResult, 'fields.name'),
		error => error.code === 'INVALID_GENERATOR_SELECTOR',
	);
});

test('resolution reports stable cycle and a maximum of four active selections', () => {
	const cycle = new Map([['loop', createTextGenerator('loop', '{{ loop:rain }}')]]);
	const cycleResolver = createGeneratorResolver({ getGenerator: id => cycle.get(id) });
	assert.throws(
		() => cycleResolver.generate('loop', 'en', { random: () => 0 }),
		error => error.code === 'GENERATOR_REFERENCE_CYCLE',
	);

	const chain = new Map([
		['chain', {
			schemaVersion: 3,
			id: 'chain',
			visibility: 'public',
			name: 'Chain',
			description: 'Nested chain',
			entrySchema: { type: 'text' },
			entries: [
				{ id: 'first', value: '{{ chain:second }}' },
				{ id: 'second', value: '{{ chain:third }}' },
				{ id: 'third', value: '{{ chain:fourth }}' },
				{ id: 'fourth', value: '{{ ending }}' },
			],
		}],
		['ending', createTextGenerator('ending', 'Done')],
	]);
	const chainResolver = createGeneratorResolver({ getGenerator: id => chain.get(id) });
	assert.throws(
		() => chainResolver.generate('chain', 'en', { random: () => 0 }),
		error => error.code === 'GENERATOR_MAX_DEPTH_EXCEEDED',
	);
});

test('modifier sources use percentage maps and ordinary resolution', () => {
	const catalogs = createLocalizedCatalogs();
	const resolver = createFixtureResolver(catalogs);
	const automatic = resolver.generate('quest', 'en', {
		random: sequenceRandom([0, 0, 0]),
	});
	assert.equal(automatic.modifiers.length, 1);
	assert.equal(automatic.modifiers[0].outputType, 'fields');
	assert.equal(automatic.modifiers[0].fields.name, 'Urgent');

	catalogs.get('en').get('quest').modifiers.quest_modifier = 25;
	const boundary = resolver.generate('quest', 'en', { random: () => 0.25 });
	assert.deepEqual(boundary.modifiers, []);
});

test('schema v3 rejects obsolete kinds, template entries, malformed references, and parity drift', () => {
	const text = createTextGenerator();
	assert.equal(validateGeneratorDefinition(text), text);
	for (const invalid of [
		{ ...text, schemaVersion: 2 },
		{ ...text, kind: 'category' },
		{ ...text, kind: 'template' },
		{ ...text, entries: [{ id: 'rain', template: '{{ weather }}', references: {} }] },
		{ ...text, entries: [{ id: 'rain', value: '{{ weather.bad-field }}' }] },
	]) {
		assert.throws(
			() => validateGeneratorDefinition(invalid),
			error => error.name === 'GeneratorSchemaError',
		);
	}

	const french = structuredClone(text);
	french.name = 'Météo';
	french.entries[0].value = 'Une pluie douce commence.';
	assert.equal(validateGeneratorPair(text, french, 'weather.json'), true);
	const mismatched = structuredClone(french);
	mismatched.entries[0].value = 'Une pluie douce {{ other }} commence.';
	assert.throws(
		() => validateGeneratorPair(text, mismatched, 'weather.json'),
		error => error.code === 'GENERATOR_LOCALE_PARITY_MISMATCH',
	);
});

test('inline relationships reject unknown generators, entries, and fields', () => {
	const source = createFieldsGenerator('source', 'Source', ['Value']);
	const owner = createTextGenerator('owner', '{{ source.missing }}');
	const catalog = new Map([['source', source], ['owner', owner]]);
	assert.throws(
		() => validateGeneratorRelationships(catalog),
		error => error.code === 'INVALID_GENERATOR_SELECTOR',
	);
	owner.entries[0].value = '{{ missing }}';
	assert.throws(
		() => validateGeneratorRelationships(catalog),
		error => error.code === 'GENERATOR_REFERENCE_MISSING',
	);
});

test('/gen rendering preserves value and structured-field layouts', () => {
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
		entryId: 'outlaw',
		outputType: 'fields',
		fields: { name: 'Outlaw', description: 'An outlaw.' },
		displayFields: { name: 'Outlaw', description: 'An outlaw.' },
		provenance: [],
		modifiers: [],
	}).toJSON();
	assert.deepEqual(fieldsEmbed.fields.map(field => field.name), ['Name', 'Description']);
});

test('/gen renders complete modifier results as separate embeds', () => {
	const response = createGeneratorResponse({
		generatorName: 'Quest',
		outputType: 'value',
		value: 'Find the lost key.',
		modifiers: [{
			generatorName: 'Quest modifiers',
			outputType: 'fields',
			displayFields: {
				name: 'Urgent',
				description: 'The deadline is tonight.',
			},
			modifiers: [],
		}],
	});
	assert.equal(response.embeds.length, 2);
	assert.equal(response.embeds[0].data.description, 'Find the lost key.');
	assert.equal(response.embeds[1].data.fields[0].name, 'Name');
	assert.match(response.embeds[1].data.title, /modifier/i);
});

test('/gen displays every field while keeping structural routes outside fields', () => {
	const generator = {
		schemaVersion: 3,
		id: 'armors',
		visibility: 'public',
		name: 'Armors',
		description: 'Armor catalog',
		entrySchema: {
			type: 'fields',
			required: ['name', 'type', 'description', 'ar_percentage'],
		},
		entries: [{
			id: 'light_armor',
			generator: 'armor_details',
			fields: {
				name: 'Light armor',
				type: 'light',
				description: 'Flexible protection.',
				ar_percentage: 25,
			},
		}],
	};
	const result = createGeneratorResolver({ getGenerator: () => generator })
		.generate('armors', 'en', { random: () => 0 });

	assert.deepEqual(result.fields, generator.entries[0].fields);
	assert.deepEqual(result.displayFields, {
		name: 'Light armor',
		type: 'light',
		description: 'Flexible protection.',
		ar_percentage: '25',
	});
	assert.deepEqual(
		createGeneratedEmbed(result).toJSON().fields.map(field => field.name),
		['Name', 'Type', 'Description', 'AR percentage'],
	);
});

test('/gen traversal follows structural routes, targets fields, and preserves modifiers', () => {
	const router = {
		schemaVersion: 3,
		id: 'router',
		visibility: 'public',
		name: 'Router',
		description: 'Routes to details',
		entrySchema: { type: 'fields', required: ['name'] },
		entries: [{
			id: 'details',
			fields: { name: 'Details' },
			generator: 'details',
		}],
	};
	const details = {
		schemaVersion: 3,
		id: 'details',
		visibility: 'internal',
		name: 'Details',
		description: 'Detailed results',
		entrySchema: { type: 'fields', required: ['name', 'score'] },
		modifiers: { detail_modifier: 100 },
		entries: [
			{ id: 'first', fields: { name: 'First', score: 10 } },
			{ id: 'second', fields: { name: 'Second', score: 20 } },
		],
	};
	const modifier = createModifierGenerator('en');
	modifier.id = 'detail_modifier';
	const catalog = new Map([
		['router', router],
		['details', details],
		['detail_modifier', modifier],
	]);
	const resolver = createGeneratorResolver({ getGenerator: id => catalog.get(id) });

	const bareRouter = resolver.generate('router', 'en', { random: () => 0 });
	assert.deepEqual(bareRouter.displayFields, { name: 'Details' });
	assert.equal(bareRouter.generatorId, 'router');
	assert.equal(resolver.generate('details', 'en', { random: () => 0 }), null);

	const routed = resolver.generate('router:details.generator:second', 'en', {
		random: () => 0,
	});
	assert.equal(routed.generatorId, 'details');
	assert.equal(routed.entryId, 'second');
	assert.equal(routed.modifiers.length, 1);
	assert.deepEqual(
		routed.provenance.map(provenanceIdentity),
		['entry:fixed:router:details', 'entry:fixed:details:second'],
	);

	const field = resolver.generate('router.generator:second.score', 'en', {
		random: () => 0,
	});
	assert.deepEqual(field.fields, { score: 20 });
	assert.deepEqual(field.displayFields, { score: 20 });
	assert.deepEqual(field.modifiers, []);
	assert.equal(resolver.generate('router:missing.generator', 'en'), null);
});

test('structural route relationships use direct stable generator IDs', () => {
	const owner = createTextGenerator('owner', 'Owner');
	owner.entries[0].generator = 'missing';
	assert.throws(
		() => validateGeneratorRelationships(new Map([['owner', owner]])),
		error => error.code === 'GENERATOR_REFERENCE_MISSING',
	);
	owner.entries[0].generator = 'target';
	const target = createTextGenerator('target', 'Target', 'internal');
	assert.equal(validateGeneratorRelationships(new Map([
		['owner', owner],
		['target', target],
	])), true);
});

test('modifier relationships reject unknown sources and statically visible cycles', () => {
	const owner = createTextGenerator('owner', 'Owner');
	owner.modifiers = { missing: 50 };
	assert.throws(
		() => validateGeneratorRelationships(new Map([['owner', owner]])),
		error => error.code === 'GENERATOR_REFERENCE_MISSING',
	);

	const first = createTextGenerator('first', 'First');
	const second = createTextGenerator('second', 'Second');
	first.modifiers = { second: 50 };
	second.modifiers = { first: 50 };
	assert.throws(
		() => validateGeneratorRelationships(new Map([
			['first', first],
			['second', second],
		])),
		error => error.code === 'GENERATOR_MODIFIER_CYCLE',
	);
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
		schemaVersion: 3,
		id: 'quest',
		visibility: 'public',
		name: french ? 'Quêtes' : 'Quests',
		description: french ? 'Amorces de quêtes' : 'Quest prompts',
		entrySchema: { type: 'text' },
		entries: [{
			id: 'recover_item',
			weight: 2,
			value: french
				? 'Récupérez {{ item.name }} auprès de {{ person:outlaw }} à {{ item }}.'
				: 'Recover {{ item.name }} from {{ person:outlaw }} at {{ item }}.',
		}],
	};
	if (includeRequest) {
		quest.modifiers = { quest_modifier: 100 };
	}
	return new Map([
		['person', createPersonGenerator(locale)],
		['item', createFieldsGenerator(
			'item',
			french ? 'Objets' : 'Items',
			french ? ['Relique', 'Registre'] : ['Relic', 'Ledger'],
		)],
		['quest_modifier', createModifierGenerator(locale)],
		['quest', quest],
	]);
}

function createTextGenerator(id = 'weather', value = 'Rain', visibility = 'public') {
	return {
		schemaVersion: 3,
		id,
		visibility,
		name: 'Weather',
		description: 'Weather prompts',
		entrySchema: { type: 'text' },
		entries: [{ id: 'rain', value }],
	};
}

function createInlineFormattingResolver(catalog) {
	return createGeneratorResolver({
		getGenerator: id => catalog.get(id),
	});
}

function createPersonGenerator(locale) {
	const french = locale === 'fr';
	return {
		schemaVersion: 3,
		id: 'person',
		visibility: 'internal',
		name: french ? 'Personnes' : 'People',
		description: french ? 'Rôles de personnages' : 'Character roles',
		entrySchema: { type: 'fields', required: ['name', 'description'] },
		entries: [{
			id: 'outlaw',
			fields: {
				name: french ? 'Hors-la-loi' : 'Outlaw',
				description: french ? 'Un hors-la-loi' : 'An outlaw',
			},
		}, {
			id: 'noble',
			fields: {
				name: french ? 'Noble' : 'Noble',
				description: french ? 'Un aristocrate' : 'An aristocrat',
			},
		}],
	};
}

function createFieldsGenerator(id, name, values) {
	return {
		schemaVersion: 3,
		id,
		visibility: 'internal',
		name,
		description: name,
		entrySchema: { type: 'fields', required: ['name', 'description'] },
		entries: values.map(value => ({
			id: value === 'Harbor' || value === 'Port'
				? 'harbor'
				: value === 'Ruins' || value === 'Ruines'
					? 'ruins'
					: value === 'Relic' || value === 'Relique'
						? 'relic'
						: 'ledger',
			fields: { name: value, description: 'A valuable object' },
		})),
	};
}

function createModifierGenerator(locale) {
	const french = locale === 'fr';
	return {
		schemaVersion: 3,
		id: 'quest_modifier',
		visibility: 'internal',
		name: french ? 'Modificateurs de quête' : 'Quest modifiers',
		description: french ? 'Variantes descriptives' : 'Descriptive variants',
		entrySchema: { type: 'fields', required: ['name', 'description'] },
		entries: [{
			id: 'urgent',
			fields: {
				name: 'Urgent',
				description: french ? 'Le temps presse.' : 'Time is running out.',
			},
		}, {
			id: 'enraged',
			weight: 2,
			fields: {
				name: french ? 'Furieux' : 'Enraged',
				description: french
					? 'Les tensions ont atteint leur paroxysme.'
					: 'Tensions have reached a breaking point.',
			},
		}],
	};
}

function createFixtureResolver(catalogs) {
	return createGeneratorResolver({
		getGenerator: (id, locale) => catalogs.get(locale).get(id),
	});
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

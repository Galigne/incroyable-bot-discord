const assert = require('node:assert/strict');
const { test } = require('node:test');
const commandRegistry = require('../commands/registry');
const {
	generateGeneratorResults,
} = require('../services/generatorApplicationService');
const { createGeneratorResolver } = require('../services/generatorResolver');
const {
	getGeneratorTraversalSuggestions,
} = require('../services/generatorTraversal');
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
		'item:relic',
		'en',
	);
	assert.deepEqual(fields.fields, {
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

test('name-only and additional-field entries resolve names through normal and explicit selection', () => {
	const weather = createTextGenerator('weather', 'Gentle rain');
	const person = createPersonGenerator('en');
	person.visibility = 'public';
	const catalog = new Map([
		['weather', weather],
		['person', person],
	]);
	const resolver = createGeneratorResolver({ getGenerator: id => catalog.get(id) });

	const nameOnly = resolver.generate('weather', 'en', { random: () => 0 });
	assert.equal(nameOnly.outputType, 'value');
	assert.equal(nameOnly.value, 'Gentle rain');
	assert.deepEqual(
		resolver.generate('weather.name', 'en', { random: () => 0 }).fields,
		{ name: 'Gentle rain' },
	);

	const structured = resolver.generate('person', 'en', { random: () => 0 });
	assert.deepEqual(structured.displayFields, {
		name: 'Outlaw',
		description: 'An outlaw',
	});
	assert.deepEqual(
		resolver.generate('person.name', 'en', { random: () => 0 }).fields,
		{ name: 'Outlaw' },
	);
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
			schemaVersion: 4,
			id: 'person',
			visibility: 'public',
			name: 'People',
			description: 'People',
			entrySchema: { required: ['description'] },
			entries: [{
				id: 'merchant',
				name: 'Merchant from {{ city }}',
				fields: {
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
			schemaVersion: 4,
			id: 'fixed_prompt',
			visibility: 'public',
			name: 'Fixed prompt',
			description: 'A fixed prompt',
			entrySchema: { required: [] },
			entries: [{ id: 'fixed_role', name: 'Meet {{ person:outlaw }}.' }],
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

test('resolution reports stable cycle and a maximum of five active selections', () => {
	const cycle = new Map([['loop', createTextGenerator('loop', '{{ loop:rain }}')]]);
	const cycleResolver = createGeneratorResolver({ getGenerator: id => cycle.get(id) });
	assert.throws(
		() => cycleResolver.generate('loop', 'en', { random: () => 0 }),
		error => error.code === 'GENERATOR_REFERENCE_CYCLE',
	);

	const chain = new Map([
		['chain', {
			schemaVersion: 4,
			id: 'chain',
			visibility: 'public',
			name: 'Chain',
			description: 'Nested chain',
			entrySchema: { required: [] },
			entries: [
				{ id: 'first', name: '{{ chain:second }}' },
				{ id: 'second', name: '{{ chain:third }}' },
				{ id: 'third', name: '{{ chain:fourth }}' },
				{ id: 'fourth', name: '{{ chain:fifth }}' },
				{ id: 'fifth', name: '{{ ending }}' },
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

test('schema v4 rejects obsolete kinds, payloads, malformed references, and parity drift', () => {
	const text = createTextGenerator();
	assert.equal(validateGeneratorDefinition(text), text);
	for (const invalid of [
		{ ...text, schemaVersion: 2 },
		{ ...text, kind: 'category' },
		{ ...text, kind: 'template' },
		{ ...text, entries: [{ id: 'rain', template: '{{ weather }}', references: {} }] },
		{ ...text, entries: [{ id: 'rain', name: '{{ weather.bad-field }}' }] },
	]) {
		assert.throws(
			() => validateGeneratorDefinition(invalid),
			error => error.name === 'GeneratorSchemaError',
		);
	}

	const french = structuredClone(text);
	french.name = 'Météo';
	french.entries[0].name = 'Une pluie douce commence.';
	assert.equal(validateGeneratorPair(text, french, 'weather.json'), true);
	const mismatched = structuredClone(french);
	mismatched.entries[0].name = 'Une pluie douce {{ other }} commence.';
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
	owner.entries[0].name = '{{ missing }}';
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

test('/gen displays every declared content field', () => {
	const generator = {
		schemaVersion: 4,
		id: 'armors',
		visibility: 'public',
		name: 'Armors',
		description: 'Armor catalog',
		entrySchema: {
			required: ['type', 'description', 'ar_percentage'],
		},
		entries: [{
			id: 'light_armor',
			name: 'Light armor',
			fields: {
				type: 'light',
				description: 'Flexible protection.',
				ar_percentage: 25,
			},
		}],
	};
	const result = createGeneratorResolver({ getGenerator: () => generator })
		.generate('armors', 'en', { random: () => 0 });

	assert.deepEqual(result.fields, {
		name: generator.entries[0].name,
		...generator.entries[0].fields,
	});
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
		schemaVersion: 4,
		id: 'router',
		visibility: 'public',
		name: 'Router',
		description: 'Routes to details',
		entrySchema: { required: [] },
		modifiers: { detail_modifier: 100 },
		entries: [{
			id: 'details',
			name: 'Details',
			generator: 'details',
		}],
	};
	const details = {
		schemaVersion: 4,
		id: 'details',
		visibility: 'internal',
		name: 'Details',
		description: 'Detailed results',
		entrySchema: { required: ['score'] },
		modifiers: { detail_modifier: 100 },
		entries: [
			{ id: 'first', name: 'First', fields: { score: 10 } },
			{ id: 'second', name: 'Second', fields: { score: 20 } },
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
	assert.equal(bareRouter.value, 'Details');
	assert.equal(bareRouter.generatorId, 'router');
	assert.deepEqual(bareRouter.modifiers, []);
	assert.equal(resolver.generate('details', 'en', { random: () => 0 }), null);

	const routed = resolver.generate('router:details:second', 'en', {
		random: () => 0,
	});
	assert.equal(routed.generatorId, 'details');
	assert.equal(routed.entryId, 'second');
	assert.equal(routed.modifiers.length, 1);
	assert.deepEqual(
		routed.provenance.map(provenanceIdentity),
		['entry:fixed:router:details', 'entry:fixed:details:second'],
	);
	const explicitRouted = resolver.generate(
		'router:details.generator:second',
		'en',
		{ random: () => 0 },
	);
	assert.equal(explicitRouted.generatorId, routed.generatorId);
	assert.equal(explicitRouted.entryId, routed.entryId);
	assert.deepEqual(explicitRouted.provenance, routed.provenance);
	assert.equal(
		resolver.resolveInlineReference('{{ router:details }}', 'en').value,
		'Details',
	);
	const inlineRouted = resolver.resolveInlineReference(
		'{{ router:details.generator:second }}',
		'en',
		{ random: () => 0 },
	);
	assert.equal(inlineRouted.value, 'Second — 20');
	assert.equal(inlineRouted.modifiers.length, 1);
	const inlineField = resolver.resolveInlineReference(
		'{{ router:details.generator:second.score }}',
		'en',
		{ random: () => 0 },
	);
	assert.equal(inlineField.value, 20);
	assert.deepEqual(inlineField.modifiers, []);
	assert.equal(
		resolver.resolveReference(
			'router:details.generator:second.score',
			'en',
			{ random: () => 0 },
		).displayFields.score,
		20,
	);

	const field = resolver.generate('router:details:second.score', 'en', {
		random: () => 0,
	});
	assert.deepEqual(field.fields, { score: 20 });
	assert.deepEqual(field.displayFields, { score: 20 });
	assert.deepEqual(field.modifiers, []);
	assert.deepEqual(
		resolver.generate('router:details.score', 'en', { random: () => 0 }).fields,
		{ score: 10 },
	);
	assert.equal(resolver.generate('router:missing', 'en'), null);
});

test('/gen validates unresolved route continuations before random selection', () => {
	const router = createTraversalRouter('router', 'public', [
		['left_route', 'left'],
		['right_route', 'right'],
	]);
	const left = createTraversalFieldsGenerator(
		'left',
		['name', 'shared', 'left_only'],
		['shared_entry', 'left_entry'],
	);
	const right = createTraversalFieldsGenerator(
		'right',
		['name', 'shared', 'right_only'],
		['shared_entry', 'right_entry'],
	);
	const catalog = new Map([
		['router', router],
		['left', left],
		['right', right],
	]);
	const getGenerator = id => catalog.get(id);
	const resolver = createGeneratorResolver({ getGenerator });

	const bare = resolver.generate('router', 'en', { random: () => 0 });
	assert.equal(bare.generatorId, 'router');
	assert.equal(bare.value, 'left_route');
	assert.deepEqual(
		resolver.generate('router.name', 'en', { random: () => 0 }).fields,
		{ name: 'left_route' },
	);
	assert.equal(
		resolver.generate('router.generator', 'en', { random: () => 0 }).generatorId,
		'left',
	);
	assert.deepEqual(
		resolver.generate('router.generator.shared', 'en', {
			random: sequenceRandom([0.999, 0]),
		}).fields,
		{ shared: 'right:shared_entry:shared' },
	);
	assert.equal(
		resolver.generate('router.generator:shared_entry.name', 'en', {
			random: () => 0.999,
		}).entryId,
		'shared_entry',
	);

	for (const invalidPath of [
		'router.generator.left_only',
		'router.generator:right_only',
		'router.generator:left_entry',
	]) {
		let randomCalls = 0;
		assert.equal(resolver.generate(invalidPath, 'en', {
			random() {
				randomCalls += 1;
				return 0;
			},
		}), null);
		assert.equal(randomCalls, 0, invalidPath);
	}

	assert.deepEqual(
		resolver.generate('router:left_route.left_only', 'en', {
			random: () => 0,
		}).fields,
		{ left_only: 'left:shared_entry:left_only' },
	);
	assert.equal(
		resolver.generate('router:left_route:left_entry.name', 'en').entryId,
		'left_entry',
	);

	const suggest = value => getGeneratorTraversalSuggestions(value, 'en', {
		getGenerator,
		listGenerators: () => [router],
	}).map(choice => choice.value);
	assert.deepEqual(suggest('router.generator:'), [
		'router.generator:shared_entry',
	]);
	assert.deepEqual(suggest('router.generator.'), [
		'router.generator.name',
		'router.generator.shared',
	]);
	assert.deepEqual(suggest('router:left_route:'), [
		'router:left_route:shared_entry',
		'router:left_route:left_entry',
	]);
	assert.deepEqual(suggest('router:left_route.'), [
		'router:left_route.name',
		'router:left_route.shared',
		'router:left_route.left_only',
	]);
	assert.deepEqual(suggest('router:left_route.generator:'), []);
});

test('/gen applies universal continuation validation through repeated random routes', () => {
	const root = createTraversalRouter('multi', 'public', [
		['left', 'branch_left'],
		['right', 'branch_right'],
	]);
	const branchLeft = createTraversalRouter('branch_left', 'internal', [
		['first', 'leaf_first'],
		['second', 'leaf_second'],
	]);
	const branchRight = createTraversalRouter('branch_right', 'internal', [
		['third', 'leaf_third'],
	]);
	const leafFirst = createTraversalFieldsGenerator(
		'leaf_first',
		['name', 'common', 'exclusive'],
		['shared_leaf', 'first_only'],
	);
	const leafSecond = createTraversalFieldsGenerator(
		'leaf_second',
		['name', 'common'],
		['shared_leaf', 'second_only'],
	);
	const leafThird = createTraversalFieldsGenerator(
		'leaf_third',
		['name', 'common'],
		['shared_leaf', 'third_only'],
	);
	const catalog = new Map([
		['multi', root],
		['branch_left', branchLeft],
		['branch_right', branchRight],
		['leaf_first', leafFirst],
		['leaf_second', leafSecond],
		['leaf_third', leafThird],
	]);
	const getGenerator = id => catalog.get(id);
	const resolver = createGeneratorResolver({ getGenerator });

	assert.deepEqual(
		resolver.generate('multi.generator.generator.common', 'en', {
			random: sequenceRandom([0.999, 0, 0]),
		}).fields,
		{ common: 'leaf_third:shared_leaf:common' },
	);
	assert.equal(
		resolver.generate('multi.generator.generator:shared_leaf.name', 'en', {
			random: sequenceRandom([0.999, 0]),
		}).entryId,
		'shared_leaf',
	);

	for (const invalidPath of [
		'multi.generator.generator.exclusive',
		'multi.generator.generator:first_only',
		'multi:left.generator.generator.exclusive',
	]) {
		let randomCalls = 0;
		assert.equal(resolver.generate(invalidPath, 'en', {
			random() {
				randomCalls += 1;
				return 0;
			},
		}), null);
		assert.equal(randomCalls, 0, invalidPath);
	}

	assert.deepEqual(
		resolver.generate('multi:left:first.exclusive', 'en', {
			random: () => 0,
		}).fields,
		{ exclusive: 'leaf_first:shared_leaf:exclusive' },
	);
	assert.deepEqual(
		getGeneratorTraversalSuggestions('multi.generator.generator.', 'en', {
			getGenerator,
			listGenerators: () => [root],
		}).map(choice => choice.value),
		[
			'multi.generator.generator.name',
			'multi.generator.generator.common',
		],
	);
});

test('/gen autocomplete ranks the active segment without filtering on earlier segments', () => {
	const ranked = {
		schemaVersion: 4,
		id: 'ranked',
		visibility: 'public',
		name: 'Ranked choices',
		description: 'Ranking fixture',
		entrySchema: { required: [] },
		entries: [
			{ id: 'long_sword', name: 'Long sword' },
			{ id: 'swordfish', name: 'Swordfish' },
			{ id: 'sword', name: 'Sword' },
		],
	};
	const getGenerator = id => id === ranked.id ? ranked : undefined;
	const listGenerators = () => [ranked];
	assert.deepEqual(
		getGeneratorTraversalSuggestions('ranked_choices:sword', 'en', {
			getGenerator,
			listGenerators,
		}).map(choice => choice.value),
		[
			'ranked_choices:sword',
			'ranked_choices:swordfish',
			'ranked_choices:long_sword',
		],
	);
});

test('structural route relationships use direct stable generator IDs', () => {
	const owner = createTraversalRouter('owner', 'public', [['route', 'missing']]);
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
		schemaVersion: 4,
		id: 'quest',
		visibility: 'public',
		name: french ? 'Quêtes' : 'Quests',
		description: french ? 'Amorces de quêtes' : 'Quest prompts',
		entrySchema: { required: [] },
		entries: [{
			id: 'recover_item',
			weight: 2,
			name: french
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
	const displayName = id.split('_')
		.map(word => word[0].toUpperCase() + word.slice(1))
		.join(' ');
	return {
		schemaVersion: 4,
		id,
		visibility,
		name: displayName,
		description: `${displayName} prompts`,
		entrySchema: { required: [] },
		entries: [{ id: 'rain', name: value }],
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
		schemaVersion: 4,
		id: 'person',
		visibility: 'internal',
		name: french ? 'Personnes' : 'People',
		description: french ? 'Rôles de personnages' : 'Character roles',
		entrySchema: { required: ['description'] },
		entries: [{
			id: 'outlaw',
			name: french ? 'Hors-la-loi' : 'Outlaw',
			fields: {
				description: french ? 'Un hors-la-loi' : 'An outlaw',
			},
		}, {
			id: 'noble',
			name: 'Noble',
			fields: {
				description: french ? 'Un aristocrate' : 'An aristocrat',
			},
		}],
	};
}

function createFieldsGenerator(id, name, values) {
	return {
		schemaVersion: 4,
		id,
		visibility: 'internal',
		name,
		description: name,
		entrySchema: { required: ['description'] },
		entries: values.map(value => ({
			id: value === 'Harbor' || value === 'Port'
				? 'harbor'
				: value === 'Ruins' || value === 'Ruines'
					? 'ruins'
					: value === 'Relic' || value === 'Relique'
						? 'relic'
						: 'ledger',
			name: value,
			fields: { description: 'A valuable object' },
		})),
	};
}

function createModifierGenerator(locale) {
	const french = locale === 'fr';
	return {
		schemaVersion: 4,
		id: 'quest_modifier',
		visibility: 'internal',
		name: french ? 'Modificateurs de quête' : 'Quest modifiers',
		description: french ? 'Variantes descriptives' : 'Descriptive variants',
		entrySchema: { required: ['description'] },
		entries: [{
			id: 'urgent',
			name: 'Urgent',
			fields: {
				description: french ? 'Le temps presse.' : 'Time is running out.',
			},
		}, {
			id: 'enraged',
			name: french ? 'Furieux' : 'Enraged',
			weight: 2,
			fields: {
				description: french
					? 'Les tensions ont atteint leur paroxysme.'
					: 'Tensions have reached a breaking point.',
			},
		}],
	};
}

function createTraversalRouter(id, visibility, routes) {
	return {
		schemaVersion: 4,
		id,
		visibility,
		name: id,
		description: id,
		entrySchema: { required: [] },
		entries: routes.map(([entryId, generator]) => ({
			id: entryId,
			name: entryId,
			generator,
		})),
	};
}

function createTraversalFieldsGenerator(id, required, entryIds) {
	const additionalFields = required.filter(field => field !== 'name');
	return {
		schemaVersion: 4,
		id,
		visibility: 'internal',
		name: id,
		description: id,
		entrySchema: { required: additionalFields },
		entries: entryIds.map(entryId => ({
			id: entryId,
			name: entryId,
			fields: Object.fromEntries(additionalFields.map(field => (
				[field, `${id}:${entryId}:${field}`]
			))),
		})),
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

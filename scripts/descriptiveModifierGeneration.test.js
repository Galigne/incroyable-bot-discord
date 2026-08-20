const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
	generateDescriptiveModifier,
} = require('../services/descriptiveModifierGenerator');
const {
	resolveGenerationMetadata,
} = require('../services/generationMetadata');
const { createGeneratorResolver } = require('../services/generatorResolver');
const { getStatProfile } = require('../services/statProfileCatalog');

const RESOLVED_NAME = 'The creature manifests a RULE Thread — A formal rule.';
const RESOLVED_DESCRIPTION = 'This manifestation follows Thread — A formal rule.';

test('random character and creature modifiers use fully resolved localized fields', () => {
	const resolver = createGeneratorResolver({
		getGenerator: id => createModifierCatalog().get(id),
	});

	for (const generator of ['modifier_character', 'modifier_creature']) {
		const modifier = generateDescriptiveModifier({
			generator,
			resolver,
			random: () => 0,
		});

		assert.equal(modifier.name, RESOLVED_NAME);
		assert.equal(modifier.description, RESOLVED_DESCRIPTION);
		assert.doesNotMatch(modifier.name, /\{\{/);
		assert.doesNotMatch(modifier.description, /\{\{/);
	}
});

test('descriptive modifier references can exclude an existing random identity', () => {
	const catalog = new Map([
		['race', {
			schemaVersion: 4,
			id: 'race',
			visibility: 'public',
			name: 'Race',
			description: 'Races',
			entrySchema: { required: [] },
			entries: [
				{ id: 'human', name: 'Human' },
				{ id: 'elf', name: 'Elf' },
			],
		}],
		['modifier_character', createFieldsGenerator('modifier_character', [{
			id: 'race_hybrid',
			name: 'Race Hybrid',
			fields: {
				description: 'Hybridized with {{ race.name }}.',
			},
		}])],
	]);
	const resolver = createGeneratorResolver({ getGenerator: id => catalog.get(id) });
	const modifier = generateDescriptiveModifier({
		generator: 'modifier_character:race_hybrid',
		random: () => 0,
		resolver,
		resolverOptions: {
			excludedEntryIdsByGenerator: { race: ['human'] },
		},
	});

	assert.equal(modifier.description, 'Hybridized with Elf.');
	assert.equal(
		modifier.provenance.find(record => record.generatorId === 'race').entryId,
		'elf',
	);
});

test('explicit character and creature modifier metadata uses fully resolved fields', () => {
	for (const [entityType, generator] of [
		['character', 'modifier_character'],
		['creature', 'modifier_creature'],
	]) {
		const resolver = createGeneratorResolver({
			getGenerator: id => createModifierCatalog().get(id),
		});
		const resolved = resolveGenerationMetadata({
			entityType,
			generation: {
				modifiers: [`${generator}:manifested`],
			},
			level: 1,
			locale: 'en',
			random: () => 0,
			resolver,
			getProfile: getStatProfile,
		});

		assert.equal(resolved.modifiers[0].name, RESOLVED_NAME);
		assert.equal(resolved.modifiers[0].description, RESOLVED_DESCRIPTION);
		assert.doesNotMatch(JSON.stringify(resolved.modifiers[0]), /\{\{/);
	}
});

test('routed descriptive modifiers use the final entry identity and retain route provenance', () => {
	const catalog = createModifierCatalog();
	catalog.set('modifier', createRouteGenerator(
		'modifier',
		'creature',
		'modifier_creature',
	));
	const resolver = createGeneratorResolver({
		getGenerator: id => catalog.get(id),
	});
	const modifier = generateDescriptiveModifier({
		generator: 'modifier:creature.generator:manifested',
		resolver,
		random: () => 0,
	});

	assert.equal(modifier.generatorId, 'modifier_creature');
	assert.equal(modifier.entryId, 'manifested');
	assert.equal(modifier.name, RESOLVED_NAME);
	assert.equal(modifier.description, RESOLVED_DESCRIPTION);
	assert.deepEqual(
		modifier.provenance.slice(0, 2)
			.map(({ generatorId, entryId }) => ({ generatorId, entryId })),
		[
			{ generatorId: 'modifier', entryId: 'creature' },
			{ generatorId: 'modifier_creature', entryId: 'manifested' },
		],
	);
});

test('resolved display fields do not replace raw typed fields for technical consumers', () => {
	const catalog = createModifierCatalog();
	catalog.set('technical', {
		schemaVersion: 4,
		id: 'technical',
		visibility: 'internal',
		name: 'Technical values',
		description: 'Typed technical values',
		entrySchema: { required: ['description', 'ar_percentage', 'is_magical'] },
		entries: [{
			id: 'typed',
			name: 'Arcane armor',
			fields: {
				description: 'A reinforced shell.',
				ar_percentage: 42,
				is_magical: true,
			},
		}],
	});
	const resolver = createGeneratorResolver({
		getGenerator: id => catalog.get(id),
	});
	const result = resolver.resolveReference('technical:typed', 'en');

	assert.equal(result.fields.ar_percentage, 42);
	assert.equal(result.fields.is_magical, true);
	assert.equal(result.displayFields.ar_percentage, '42');
	assert.equal(result.displayFields.is_magical, 'true');
	assert.equal(result.display, 'Arcane armor — A reinforced shell. — 42 — true');
});

test('modifier inline references preserve cycle and nesting-depth protections', () => {
	const cycleCatalog = createModifierCatalog();
	cycleCatalog.set('nested_rule', createTextGenerator(
		'nested_rule',
		'{{ modifier_character }}',
	));
	const cycleResolver = createGeneratorResolver({
		getGenerator: id => cycleCatalog.get(id),
	});
	assert.throws(
		() => generateDescriptiveModifier({
			generator: 'modifier_character',
			resolver: cycleResolver,
			random: () => 0,
		}),
		error => error.code === 'GENERATOR_REFERENCE_CYCLE',
	);

	const depthCatalog = createModifierCatalog();
	depthCatalog.get('modifier_character').entries[0].name = '{{ depth_one }}';
	depthCatalog.set('depth_one', createTextGenerator('depth_one', '{{ depth_two }}'));
	depthCatalog.set('depth_two', createTextGenerator('depth_two', '{{ depth_three }}'));
	depthCatalog.set('depth_three', createTextGenerator('depth_three', '{{ depth_four }}'));
	depthCatalog.set('depth_four', createTextGenerator('depth_four', 'Done'));
	const depthResolver = createGeneratorResolver({
		getGenerator: id => depthCatalog.get(id),
	});
	assert.throws(
		() => generateDescriptiveModifier({
			generator: 'modifier_character',
			resolver: depthResolver,
			random: () => 0,
		}),
		error => error.code === 'GENERATOR_MAX_DEPTH_EXCEEDED',
	);
});

function createModifierCatalog() {
	const rules = createFieldsGenerator('rules', [{
		id: 'thread',
		name: 'Thread',
		fields: { description: 'A formal rule.' },
	}]);
	const nestedRule = createTextGenerator('nested_rule', '{{ rules:thread }}');
	const modifierEntry = {
		id: 'manifested',
		name: 'The creature manifests a RULE {{ rules }}',
		fields: {
			description: 'This manifestation follows {{ nested_rule }}',
		},
	};
	const catalog = new Map([
		['rules', rules],
		['nested_rule', nestedRule],
	]);
	for (const generator of ['modifier_character', 'modifier_creature']) {
		catalog.set(generator, createFieldsGenerator(generator, [modifierEntry]));
	}
	return catalog;
}

function createFieldsGenerator(id, entries) {
	return {
		schemaVersion: 4,
		id,
		visibility: 'internal',
		name: id,
		description: id,
		entrySchema: { required: ['description'] },
		entries,
	};
}

function createRouteGenerator(id, entryId, targetGeneratorId) {
	return {
		schemaVersion: 4,
		id,
		visibility: 'public',
		name: id,
		description: id,
		entrySchema: { required: [] },
		entries: [{ id: entryId, name: entryId, generator: targetGeneratorId }],
	};
}

function createTextGenerator(id, value) {
	return {
		schemaVersion: 4,
		id,
		visibility: 'internal',
		name: id,
		description: id,
		entrySchema: { required: [] },
		entries: [{ id: 'value', name: value }],
	};
}

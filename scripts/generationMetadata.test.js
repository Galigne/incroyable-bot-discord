const assert = require('node:assert/strict');
const { test } = require('node:test');
const generatorResolver = require('../services/generatorResolver');
const {
	resolveGenerationMetadata,
} = require('../services/generationMetadata');
const { getStatProfile } = require('../services/statProfileCatalog');

test('shared generation metadata resolution replaces common categories for both entity types', () => {
	for (const [entityType, templateProperty, templateId, modifierGenerator, modifierId] of [
		['character', 'talents', 'athlete', 'modifier_character', 'scarred'],
		['creature', 'traits', 'keen_smell', 'modifier_creature', 'smoldering'],
	]) {
		const resolved = resolveGenerationMetadata({
			entityType,
			generation: {
				statProfile: 'default',
				naturalArmorPercentage: 12,
				[templateProperty]: [`{{ ${templateProperty}:${templateId} }}`],
				fixedRules: [{ entry: 'thread_rule', level: 2 }],
				statusEffects: ['status_effect:bruised'],
				modifiers: [`${modifierGenerator}:${modifierId}`],
				armor: 'armors:padded_armor',
				equipment: ['shields:buckler'],
				inventory: ['shields:round_shield'],
			},
			level: 5,
			locale: 'en',
			random: () => 0,
			resolver: generatorResolver,
			getProfile: getStatProfile,
			defaults: {
				includeRuleEntryId: entityType === 'creature',
			},
		});

		assert.equal(resolved.statProfileId, 'default');
		assert.equal(resolved.naturalArmorPercentage, 12);
		assert.equal(resolved.templates.length, 1);
		assert.equal(resolved.rules.length, 1);
		assert.equal(resolved.rules[0].level, 2);
		assert.equal(
			Object.hasOwn(resolved.rules[0], 'entryId'),
			entityType === 'creature',
		);
		assert.equal(resolved.statusEffects.length, 1);
		assert.equal(resolved.modifiers.length, 1);
		assert.equal(resolved.gear.equipment.length, 1);
		assert.equal(resolved.gear.inventory.length, 1);
		assert.equal(resolved.armorPercentage, 22);
		for (const item of [
			resolved.gear.armor,
			...resolved.gear.equipment,
			...resolved.gear.inventory,
		]) {
			assert.match(item, / — Common — Made of [^—]+ — Runed — /);
		}
	}
});

test('shared generation metadata resolution preserves defaults and suppresses explicit empty arrays', () => {
	for (const entityType of ['character', 'creature']) {
		const resolved = resolveGenerationMetadata({
			entityType,
			generation: {
				fixedRules: [],
				statusEffects: [],
				modifiers: [],
				[entityType === 'character' ? 'talents' : 'traits']: [],
				equipment: [],
				inventory: [],
			},
			level: 1,
			locale: 'en',
			random: () => 0,
			resolver: generatorResolver,
			getProfile: getStatProfile,
			defaults: {
				templates: () => ['normal template'],
				fixedRules: () => [{ name: 'normal rule' }],
				statusEffects: () => [{ name: 'normal effect' }],
				modifiers: () => [{ name: 'normal modifier' }],
				armor: () => ({ value: 'normal armor', armorPercentage: 7 }),
				equipment: () => ({ values: ['normal equipment'], armorPercentage: 3 }),
				inventory: () => ({ values: ['normal inventory'] }),
			},
		});

		assert.deepEqual(resolved.templates, []);
		assert.deepEqual(resolved.rules, []);
		assert.deepEqual(resolved.statusEffects, []);
		assert.deepEqual(resolved.modifiers, []);
		assert.deepEqual(resolved.gear.equipment, []);
		assert.deepEqual(resolved.gear.inventory, []);
		assert.deepEqual(resolved.gear.armor, 'normal armor');
		assert.equal(resolved.armorPercentage, 7);
	}
});

test('described generation references retain final identities through routes', () => {
	const catalog = createDescribedReferenceCatalog();
	const resolver = generatorResolver.createGeneratorResolver({
		getGenerator: id => catalog.get(id),
	});
	const weightedStatusReference = {
		generator: {
			oneOf: [{ id: 'status_effect', weight: 1 }],
		},
		select: 'fields',
	};
	const resolved = resolveGenerationMetadata({
		entityType: 'creature',
		generation: {
			statusEffects: [
				'condition:status.generator:bruised',
				'status_effect:bruised',
				weightedStatusReference,
			],
			modifiers: ['modifier:creature.generator:shadowed'],
		},
		level: 1,
		locale: 'en',
		random: () => 0,
		resolver,
		getProfile: getStatProfile,
	});

	assert.deepEqual(resolved.modifiers[0], {
		generatorId: 'modifier_creature',
		entryId: 'shadowed',
		name: 'Shadowed',
		description: 'The final creature modifier.',
		provenance: [
			{
				type: 'entry',
				selection: 'fixed',
				generatorId: 'modifier',
				entryId: 'creature',
				path: 'root.generation.modifiers.0.routes.0',
			},
			{
				type: 'entry',
				selection: 'fixed',
				generatorId: 'modifier_creature',
				entryId: 'shadowed',
				path: 'root.generation.modifiers.0',
			},
		],
	});
	assert.deepEqual(resolved.statusEffects[0], {
		generatorId: 'status_effect',
		entryId: 'bruised',
		name: 'Bruised',
		description: 'The final status effect.',
		provenance: [
			{
				type: 'entry',
				selection: 'fixed',
				generatorId: 'condition',
				entryId: 'status',
				path: 'root.generation.statusEffects.0.routes.0',
			},
			{
				type: 'entry',
				selection: 'fixed',
				generatorId: 'status_effect',
				entryId: 'bruised',
				path: 'root.generation.statusEffects.0',
			},
		],
	});
	assert.deepEqual(
		resolved.statusEffects[1],
		{
			generatorId: 'status_effect',
			entryId: 'bruised',
			name: 'Bruised',
			description: 'The final status effect.',
			provenance: [{
				type: 'entry',
				selection: 'fixed',
				generatorId: 'status_effect',
				entryId: 'bruised',
				path: 'root.generation.statusEffects.1',
			}],
		},
	);
	assert.deepEqual(
		resolved.statusEffects[2],
		{
			generatorId: 'status_effect',
			entryId: 'bruised',
			name: 'Bruised',
			description: 'The final status effect.',
			provenance: [
				{
					type: 'generator-source',
					selection: 'weighted',
					generatorId: 'status_effect',
					path: 'root.generation.statusEffects.2',
				},
				{
					type: 'entry',
					selection: 'random',
					generatorId: 'status_effect',
					entryId: 'bruised',
					path: 'root.generation.statusEffects.2',
				},
			],
		},
	);
});

function createDescribedReferenceCatalog() {
	return new Map([
		['modifier', createRouteGenerator('modifier', 'creature', 'modifier_creature')],
		['condition', createRouteGenerator('condition', 'status', 'status_effect')],
		['modifier_creature', createDescribedGenerator(
			'modifier_creature',
			'shadowed',
			'Shadowed',
			'The final creature modifier.',
		)],
		['status_effect', createDescribedGenerator(
			'status_effect',
			'bruised',
			'Bruised',
			'The final status effect.',
		)],
	]);
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

function createDescribedGenerator(id, entryId, name, description) {
	return {
		schemaVersion: 4,
		id,
		visibility: 'internal',
		name: id,
		description: id,
		entrySchema: { required: ['description'] },
		entries: [{ id: entryId, name, fields: { description } }],
	};
}

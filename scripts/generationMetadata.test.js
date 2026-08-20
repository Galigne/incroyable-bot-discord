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
				statusEffects: [{
					generator: 'status_effect',
					entry: 'bruised',
					select: 'fields',
				}],
				modifiers: [{
					generator: modifierGenerator,
					entry: modifierId,
					select: 'fields',
				}],
				armor: {
					generator: 'armors',
					entry: 'padded_armor',
					select: 'fields',
				},
				equipment: [{
					generator: 'shields',
					entry: 'buckler',
					select: 'display',
				}],
				inventory: [{
					generator: 'shields',
					entry: 'round_shield',
					select: 'fields',
				}],
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

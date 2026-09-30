const assert = require('node:assert/strict');
const { test } = require('node:test');
const Character = require('../models/Character');
const Creature = require('../models/Creature');
const { BASE_STATS } = require('../services/mechanics/constants');
const { createCharacterSummaryEmbed, createCharacterFieldEmbed } = require('../util/characterRenderer');
const { createCreatureSummaryEmbed, createCreatureFieldEmbed } = require('../util/creatureRenderer');
const { getCharacterFieldLabel } = require('../util/characterDisplay');
const { getEntityFieldLabel } = require('../util/entityDisplay');
const { formatCombatantResources } = require('../util/combatantDisplay');
const { formatSummaryList, formatNumberedSummaryList } = require('../util/entityRendererPrimitives');
const { t } = require('../util/i18n');

const renderers = [
	{ Model: Character, render: createCharacterSummaryEmbed, detail: createCharacterFieldEmbed, collection: 'talents' },
	{ Model: Creature, render: createCreatureSummaryEmbed, detail: createCreatureFieldEmbed, collection: 'traits' },
];
function assertFieldLimits(embed) {
	for (const field of embed.fields) {
		assert.ok(field.value.length > 0 && field.value.length <= 1_024, field.name);
	}
}
function numbered(items) { return items.map((item, index) => `${index + 1}. ${item}`).join('\n'); }

for (const locale of ['en', 'fr']) {
	test(`character summary preserves the two-row field layout in ${locale}`, () => {
		const character = new Character('Summary.Layout');
		character.race.traits = { skillBonus: 'Arcana bonus', physicalAbility: 'Night sight' };
		character.rules = [{ name: 'Fire', level: 2, description: 'Flames' }];
		character.talents = ['Athlete — Runs swiftly.'];
		const embed = createCharacterSummaryEmbed(character, locale).toJSON();
		const label = id => getCharacterFieldLabel(locale, id);
		assert.deepEqual(embed.fields.map(field => [field.name, field.inline]), [
			[label('status'), false], [label('statistics'), true], [label('rules'), true],
			['\u200B', false], [label('race.traits'), true], [label('talents'), true],
		]);
		assert.equal(embed.fields[3].value, '\u200B');
		assert.equal(embed.fields[1].value, BASE_STATS.map(stat => `${label(`statistics.${stat}`)}: **${character.statistics[stat]}**`).join('\n'));
		assert.equal(embed.fields[4].value, `${label('race.traits.skillBonus')}: Arcana bonus\n${label('race.traits.physicalAbility')}: Night sight`);
		assert.doesNotMatch(embed.fields[1].value, /Arcana|Night sight/);
		assert.doesNotMatch(embed.fields[2].value, /Athlete/);
		assert.equal(embed.fields[5].value, '1. Athlete — Runs swiftly.');
		assert.equal(embed.color, 0xFFD700);
		assertFieldLimits(embed);
	});

	test(`character row break is conditional for every optional-field combination in ${locale}`, () => {
		for (const rules of [false, true]) {
			for (const racial of [false, true]) {
				for (const talents of [false, true]) {
					const character = new Character('Summary.Optional');
					character.rules = rules ? [{ name: 'Fire', level: 1 }] : [];
					character.race.traits.skillBonus = racial ? 'Arcana' : '  ';
					character.talents = talents ? ['Athlete'] : [];
					const label = id => getCharacterFieldLabel(locale, id);
					const embed = createCharacterSummaryEmbed(character, locale).toJSON();
					assert.deepEqual(embed.fields.map(field => field.name), [
						label('status'), label('statistics'), ...(rules ? [label('rules')] : []),
						...(racial || talents ? ['\u200B'] : []), ...(racial ? [label('race.traits')] : []),
						...(talents ? [label('talents')] : []),
					]);
					assertFieldLimits(embed);
				}
			}
		}
	});

	test(`creature traits have a full-width field with or without RULEs in ${locale}`, () => {
		for (const rules of [false, true]) {
			for (const traits of [false, true]) {
				const creature = new Creature('Summary.Creature');
				creature.rules = rules ? [{ name: 'Fire', level: 1 }] : [];
				creature.traits = traits ? ['Night sight'] : [];
				const label = id => getEntityFieldLabel(locale, 'creature', id);
				const embed = createCreatureSummaryEmbed(creature, locale).toJSON();
				assert.deepEqual(embed.fields.map(field => [field.name, field.inline]), [
					[label('status'), false], [label('statistics'), true],
					...(rules ? [[label('rules'), true]] : []), ...(traits ? [[label('traits'), false]] : []),
				]);
				if (rules) assert.doesNotMatch(embed.fields[2].value, /Night sight/);
				if (traits) assert.equal(embed.fields.at(-1).value, '1. Night sight');
				assert.equal(embed.color, 0x8B5CF6);
				assertFieldLimits(embed);
			}
		}
	});

	for (const { Model, render, detail, collection } of renderers) {
		test(`${collection} and RULEs display content beyond 250 characters in ${locale}`, () => {
			const entity = new Model('Summary.Capacity');
			entity.rules = Array.from({ length: 18 }, (_, index) => ({ name: `RULE ${index + 1}`, level: 2, description: 'Details' }));
			entity[collection] = ['A'.repeat(400), 'B'.repeat(400)];
			const embed = render(entity, locale).toJSON();
			const expectedRules = numbered(entity.rules.map(rule => t(locale, `${entity.type}.summary.ruleLevel`, rule)));
			assert.ok(expectedRules.length > 250 && expectedRules.length <= 1_024);
			assert.equal(embed.fields[2].value, expectedRules);
			assert.equal(embed.fields.at(-1).value, numbered(entity[collection]));
			assert.ok(embed.fields.at(-1).value.length > 250);
			assert.equal(detail(entity, collection, locale).toJSON().description, numbered(entity[collection]));
			assertFieldLimits(embed);
		});

		test(`${collection} retain complete numbered entries and exact omission counts in ${locale}`, () => {
			const entity = new Model('Summary.Omissions');
			entity[collection] = Array.from({ length: 12 }, (_, index) => `${index}: ${'x'.repeat(195)}`);
			const embed = render(entity, locale).toJSON();
			assert.equal(embed.fields.at(-1).value, `${numbered(entity[collection].slice(0, 5))}\n... (+7)`);
			assertFieldLimits(embed);
			entity[collection] = ['x'.repeat(2_000), 'second', 'third'];
			assert.equal(render(entity, locale).toJSON().fields.at(-1).value, '... (+3)');
		});

		test(`${Model.name} Status reserves resources, headings and both omission counts in ${locale}`, () => {
			const entity = new Model('Summary.Status');
			entity.status.effects = Array.from({ length: 12 }, (_, index) => ({ name: `Effect ${index}`, description: 'x'.repeat(180) }));
			entity.status.modifiers = Array.from({ length: 3 }, (_, index) => ({ name: `Modifier ${index}`, description: 'y'.repeat(200) }));
			const embed = render(entity, locale).toJSON();
			const resources = formatCombatantResources(entity, ['hp', 'ar', 'ap', 'md'], locale);
			const label = id => getEntityFieldLabel(locale, entity.type, id);
			const status = embed.fields[0].value;
			assert.ok(status.startsWith(`${resources}\n\n**${label('status.effects')}**\n`));
			const sections = status.slice(resources.length + 2).split(`\n\n**${label('status.modifiers')}**\n`);
			assert.equal(sections.length, 2);
			for (const [index, entries] of [entity.status.effects, entity.status.modifiers].entries()) {
				const shown = entries.filter(record => sections[index].includes(`**${record.name}** - ${record.description}`)).length;
				assert.ok(shown < entries.length);
				assert.ok(sections[index].endsWith(`... (+${entries.length - shown})`));
			}
			assertFieldLimits(embed);
			entity.status.effects = [{ name: 'Oversized', description: 'x'.repeat(2_000) }];
			entity.status.modifiers = [{ name: 'Oversized modifier', description: 'y'.repeat(2_000) }];
			const oversized = render(entity, locale).toJSON();
			assert.equal(oversized.fields[0].value, `${resources}\n\n**${label('status.effects')}**\n... (+1)\n\n**${label('status.modifiers')}**\n... (+1)`);
			assertFieldLimits(oversized);
		});
	}
}

test('racial traits use their own 1024-character field and retain labeled entries', () => {
	const character = new Character('Summary.RacialCapacity');
	character.race.traits = { skillBonus: 'A'.repeat(400), physicalAbility: 'B'.repeat(400) };
	let embed = createCharacterSummaryEmbed(character).toJSON();
	assert.equal(embed.fields[3].value, `Racial skill bonus: ${character.race.traits.skillBonus}\nRacial physical ability: ${character.race.traits.physicalAbility}`);
	assertFieldLimits(embed);
	character.race.traits = { skillBonus: 'A'.repeat(990), physicalAbility: 'B'.repeat(100) };
	embed = createCharacterSummaryEmbed(character).toJSON();
	assert.equal(embed.fields[3].value, `Racial skill bonus: ${character.race.traits.skillBonus}\n... (+1)`);
	assertFieldLimits(embed);
});

test('summary collection formatter budgets marker digits, separators and numbering exactly', () => {
	assert.equal(formatSummaryList(['a'.repeat(1_024)], 1_024), 'a'.repeat(1_024));
	assert.equal(formatNumberedSummaryList(['a'.repeat(1_021)], 1_024), `1. ${'a'.repeat(1_021)}`);
	assert.equal(formatSummaryList(['a'.repeat(1_015), 'b'.repeat(100)]), `${'a'.repeat(1_015)}\n... (+1)`);
	assert.equal(formatSummaryList(['a'.repeat(1_016), 'b'.repeat(100)]), '... (+2)');
	assert.equal(formatSummaryList(['a'.repeat(1_014), ...Array(10).fill('b'.repeat(100))]), `${'a'.repeat(1_014)}\n... (+10)`);
	assert.equal(formatSummaryList(['a'.repeat(1_015), ...Array(10).fill('b'.repeat(100))]), '... (+11)');
	assert.equal(formatSummaryList([], 0), '');
	for (let maxLength = 0; maxLength <= 100; maxLength++) {
		const items = ['first', 'second', 'third'.repeat(30)];
		const result = formatNumberedSummaryList(items, maxLength);
		assert.ok(result.length <= maxLength, `budget ${maxLength}`);
		if (result) {
			const lines = result.split('\n');
			assert.equal(lines.at(-1), `... (+${items.length - lines.length + 1})`);
			assert.deepEqual(lines.slice(0, -1), items.slice(0, lines.length - 1).map((item, index) => `${index + 1}. ${item}`));
		}
	}
});

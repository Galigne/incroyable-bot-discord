const assert = require('node:assert/strict');
const { test } = require('node:test');

const Character = require('../models/Character');
const {
	createGeneratedCharacterResponse,
} = require('../util/characterCommandResponses');
const { createEntityGetResponse } = require('../util/entityCommandResponses');
const { createGeneratedEmbed } = require('../util/generatorResponses');
const { flattenKeys, translations } = require('../util/i18n');

test('generated prompt embeds have no footer', () => {
	const embed = createGeneratedEmbed({
		generatorName: 'prompt',
		outputType: 'value',
		value: 'A generated prompt',
		modifiers: [],
	}).toJSON();

	assert.equal(embed.footer, undefined);
});

test('character summary and detail embeds have no footer', () => {
	const character = new Character('Footer.Test', 'creator');
	const summary = createEntityGetResponse(character, null, 'en')
		.embeds[0].toJSON();
	const detail = createEntityGetResponse(character, 'race', 'en')
		.embeds[0].toJSON();

	assert.equal(summary.footer, undefined);
	assert.equal(detail.footer, undefined);
});

test('/get gear retains the manual encumbrance detail', () => {
	const character = new Character('Encumbrance.Get', 'creator');
	character.gear.encumbrance = { current: 3, max: 8 };
	const detail = createEntityGetResponse(character, 'gear', 'en')
		.embeds[0].toJSON();

	assert.equal(
		detail.fields.find(field => field.name === 'Encumbrance').value,
		'Encumbrance: **3 / 8**',
	);
});

test('/get renders every grouped section from unchanged stored properties', () => {
	const character = new Character('Grouped.Get', 'creator');
	character.name.firstName = 'Ada';
	character.name.lastName = 'Lovelace';
	character.level = 4;
	character.status = {
		hp: { current: 50, max: 100 },
		ar: { current: 5, max: 10 },
		ap: { current: 2, max: 4 },
		md: { current: 3, max: 6 },
	};
	character.status.effects = ['Inspired'];
	character.gear.equipment = ['Sword'];
	character.gear.inventory = ['Potion'];
	character.gear.encumbrance = { current: 3, max: 8 };
	character.race = {
		name: 'Ashborn',
		physicalDescription: 'Silver eyes',
		lore: 'Forged in starlight',
	};
	character.race.traits = {
		skillBonus: 'Arcana',
		physicalAbility: 'Night sight',
	};
	character.background.appearance = 'Green cloak';
	character.background.backstory = 'Former courier';
	character.background.goals = 'Map every road';
	character.personality = {
		traits: ['Patient', 'Observant'],
		description: 'Quiet and curious',
	};

	const name = createEntityGetResponse(character, 'name', 'en').embeds[0].toJSON();
	assert.deepEqual(name.fields.map(field => field.value), ['Ada', 'Lovelace']);
	assert.equal(
		createEntityGetResponse(character, 'level', 'en').embeds[0].toJSON().description,
		'4',
	);
	const status = createEntityGetResponse(character, 'status', 'en').embeds[0].toJSON();
	assert.deepEqual(status.fields.map(field => field.name), [
		'Hit points', 'Armor rating', 'Action points', 'Movement distance', 'Status effects',
	]);
	assert.match(status.fields[0].value, /HP: \*\*50 \/ 100 \(50%\)\*\*/);
	assert.equal(status.fields[4].value, '1. Inspired');
	assert.equal(status.fields.some(field => field.name === 'Encumbrance'), false);

	const gear = createEntityGetResponse(character, 'gear', 'en').embeds[0].toJSON();
	assert.deepEqual(gear.fields.map(field => field.name), [
		'Equipment', 'Inventory', 'Encumbrance',
	]);
	assert.equal(gear.fields[0].value, '1. Sword');
	assert.equal(gear.fields[1].value, '1. Potion');

	const race = createEntityGetResponse(character, 'race', 'en').embeds[0].toJSON();
	assert.deepEqual(race.fields.map(field => field.value), [
		'Ashborn', 'Silver eyes', 'Forged in starlight', 'Arcana', 'Night sight',
	]);
	const background = createEntityGetResponse(character, 'background', 'en')
		.embeds[0].toJSON();
	assert.deepEqual(background.fields.map(field => field.value), [
		'Green cloak', 'Former courier', 'Map every road',
	]);
	const personality = createEntityGetResponse(character, 'personality', 'en')
		.embeds[0].toJSON();
	assert.deepEqual(personality.fields.map(field => field.value), [
		'1. Patient\n2. Observant', 'Quiet and curious',
	]);
});

test('/get rejects former independent child views and safely truncates grouped lists', () => {
	const character = new Character('Grouped.Bounds', 'creator');
	for (const field of [
		'firstName', 'lastName', 'appearance', 'backstory', 'goals', 'racialTraits',
		'status-effects', 'hp', 'ar', 'ap', 'md', 'equipment', 'inventory',
		'encumbrance',
	]) {
		const response = createEntityGetResponse(character, field, 'en');
		assert.equal(response.embeds, undefined, field);
		assert.match(response.content, /field is not available for this entity/, field);
	}
	character.gear.equipment = ['A'.repeat(2_000), 'second'];
	const gear = createEntityGetResponse(character, 'gear', 'en').embeds[0].toJSON();
	assert.ok(gear.fields[0].value.length <= 1_024);
	assert.match(gear.fields[0].value, /^1\. .*…$/);
	assert.equal(gear.fields.some(field => field.name === '\u200B'), false);
});

test('character summaries and talent details render localized bounded lists', () => {
	const character = new Character('Talent.Render', 'creator');
	character.talents = [
		'Athlete — +1 to sustained movement.',
		'Cold Immunity — Ordinary cold cannot freeze the character.',
	];

	const summary = createEntityGetResponse(character, null, 'en')
		.embeds[0].toJSON();
	const detailed = createEntityGetResponse(character, 'talents', 'en')
		.embeds[0].toJSON();
	assert.match(
		summary.fields[2].value,
		/^1\. Athlete — \+1 to sustained movement\.\n2\. Cold Immunity —/,
	);
	assert.equal(summary.fields[2].name, 'Talents');
	assert.equal(detailed.description, [
		'1. Athlete — +1 to sustained movement.',
		'2. Cold Immunity — Ordinary cold cannot freeze the character.',
	].join('\n'));

	const emptyEnglish = createEntityGetResponse(
		new Character('Empty.English', 'creator'),
		'talents',
		'en',
	).embeds[0].toJSON();
	const emptyFrench = createEntityGetResponse(
		new Character('Empty.French', 'creator'),
		'talents',
		'fr',
	).embeds[0].toJSON();
	assert.equal(emptyEnglish.description, translations.en.common.empty);
	assert.equal(emptyFrench.description, translations.fr.common.empty);

	character.talents = ['A'.repeat(5_000)];
	const boundedSummary = createEntityGetResponse(character, null, 'en')
		.embeds[0].toJSON();
	const boundedDetailed = createEntityGetResponse(character, 'talents', 'en')
		.embeds[0].toJSON();
	assert.ok(boundedSummary.fields[2].value.length <= 1_024);
	assert.equal(boundedDetailed.description.length, 4_096);
	assert.match(boundedDetailed.description, /…$/);
});

test('character summaries omit empty optional content and all gear lists', () => {
	const character = new Character('Concise.Summary', 'creator');
	character.gear.equipment = ['Sword'];
	character.gear.inventory = ['Potion'];

	const emptySummary = createEntityGetResponse(character, null, 'en')
		.embeds[0].toJSON();
	assert.deepEqual(emptySummary.fields.map(field => field.name), [
		'Status', 'Statistics',
	]);
	assert.equal(emptySummary.description, 'Level **1**');
	assert.doesNotMatch(JSON.stringify(emptySummary), /—|Equipment|Inventory/);
	assert.doesNotMatch(emptySummary.fields[0].value, /Status effects|Modifiers/);
	assert.doesNotMatch(emptySummary.fields[1].value, /Racial traits/);

	character.background.appearance = 'Green cloak';
	character.race.name = 'Ashborn';
	character.race.traits.skillBonus = 'Arcana';
	character.status.effects = ['Inspired'];
	character.modifiers = [{ name: 'Moonlit', description: 'Glows softly.' }];
	character.rules = [{ name: 'Fire', level: 2, description: 'Controls flames.' }];
	character.talents = ['Athlete'];

	const populatedSummary = createEntityGetResponse(character, null, 'en')
		.embeds[0].toJSON();
	assert.match(populatedSummary.description, /Race \*\*Ashborn\*\*\nGreen cloak$/);
	assert.match(populatedSummary.fields[0].value, /\*\*Status effects\*\*\n1\. Inspired/);
	assert.match(populatedSummary.fields[0].value, /\*\*Descriptive modifiers\*\*/);
	assert.match(populatedSummary.fields[1].value, /Racial skill bonus: Arcana/);
	assert.doesNotMatch(populatedSummary.fields[1].value, /Racial physical ability/);
	assert.match(populatedSummary.fields[2].value, /Fire \(Level 2\)/);
	assert.match(populatedSummary.fields[2].value, /\*\*Talents\*\*\n1\. Athlete/);
	assert.doesNotMatch(JSON.stringify(populatedSummary), /Equipment|Inventory/);
});

test('generated character embeds have no footer', () => {
	const character = new Character('Generated.Footer.Test', 'creator');
	const embed = createGeneratedCharacterResponse(character, 'en')
		.embeds[0].toJSON();

	assert.equal(embed.footer, undefined);
});

test('locale catalogs have identical structures and no footer keys', () => {
	const englishKeys = flattenKeys(translations.en).sort();
	const frenchKeys = flattenKeys(translations.fr).sort();

	assert.deepEqual(englishKeys, frenchKeys);
	assert.deepEqual(
		englishKeys.filter(key => key.toLowerCase().includes('footer')),
		[],
	);
});

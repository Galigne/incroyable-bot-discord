const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const Character = require('../models/Character');
const {
	createCharacterGetResponse,
	createGeneratedCharacterResponse,
} = require('../util/characterCommandResponses');
const { createGeneratedEmbed } = require('../util/generatorResponses');
const { flattenKeys, translations } = require('../util/i18n');

const root = path.join(__dirname, '..');

test('generated prompt embeds have no footer', () => {
	const embed = createGeneratedEmbed({
		category: { name: 'prompt' },
		entry: 'A generated prompt',
	}).toJSON();

	assert.equal(embed.footer, undefined);
});

test('character summary and detail embeds have no footer', () => {
	const character = new Character('Footer.Test', 'creator');
	const summary = createCharacterGetResponse(character, null, 'en')
		.embeds[0].toJSON();
	const detail = createCharacterGetResponse(character, 'race', 'en')
		.embeds[0].toJSON();

	assert.equal(summary.footer, undefined);
	assert.equal(detail.footer, undefined);
});

test('/get gear retains the manual encumbrance detail', () => {
	const character = new Character('Encumbrance.Get', 'creator');
	character.encumbrance = { current: 3, max: 8 };
	const detail = createCharacterGetResponse(character, 'gear', 'en')
		.embeds[0].toJSON();

	assert.equal(
		detail.fields.find(field => field.name === 'Encumbrance').value,
		'Encumbrance: **3 / 8**',
	);
});

test('/get renders every grouped section from unchanged stored properties', () => {
	const character = new Character('Grouped.Get', 'creator');
	character.firstName = 'Ada';
	character.lastName = 'Lovelace';
	character.level = 4;
	character.resources = {
		hp: { current: 50, max: 100 },
		ar: { current: 5, max: 10 },
		ap: { current: 2, max: 4 },
		md: { current: 3, max: 6 },
	};
	character.statusEffects = ['Inspired'];
	character.equipment = ['Sword'];
	character.inventory = ['Potion'];
	character.encumbrance = { current: 3, max: 8 };
	character.race = {
		name: 'Ashborn',
		physicalDescription: 'Silver eyes',
		lore: 'Forged in starlight',
	};
	character.racialTraits = {
		skillBonus: 'Arcana',
		physicalAbility: 'Night sight',
	};
	character.appearance = 'Green cloak';
	character.backstory = 'Former courier';
	character.goals = 'Map every road';
	character.personality = {
		traits: ['Patient', 'Observant'],
		description: 'Quiet and curious',
	};

	const name = createCharacterGetResponse(character, 'name', 'en').embeds[0].toJSON();
	assert.deepEqual(name.fields.map(field => field.value), ['Ada', 'Lovelace']);
	assert.equal(
		createCharacterGetResponse(character, 'level', 'en').embeds[0].toJSON().description,
		'4',
	);
	const status = createCharacterGetResponse(character, 'status', 'en').embeds[0].toJSON();
	assert.deepEqual(status.fields.map(field => field.name), [
		'Hit points', 'Armor rating', 'Action points', 'Movement distance', 'Status effects',
	]);
	assert.match(status.fields[0].value, /HP: \*\*50 \/ 100 \(50%\)\*\*/);
	assert.equal(status.fields[4].value, '1. Inspired');
	assert.equal(status.fields.some(field => field.name === 'Encumbrance'), false);

	const gear = createCharacterGetResponse(character, 'gear', 'en').embeds[0].toJSON();
	assert.deepEqual(gear.fields.map(field => field.name), [
		'Equipment', 'Inventory', 'Encumbrance',
	]);
	assert.equal(gear.fields[0].value, '1. Sword');
	assert.equal(gear.fields[1].value, '1. Potion');

	const race = createCharacterGetResponse(character, 'race', 'en').embeds[0].toJSON();
	assert.deepEqual(race.fields.map(field => field.value), [
		'Ashborn', 'Silver eyes', 'Forged in starlight', 'Arcana', 'Night sight',
	]);
	const background = createCharacterGetResponse(character, 'background', 'en')
		.embeds[0].toJSON();
	assert.deepEqual(background.fields.map(field => field.value), [
		'Green cloak', 'Former courier', 'Map every road',
	]);
	const personality = createCharacterGetResponse(character, 'personality', 'en')
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
		const response = createCharacterGetResponse(character, field, 'en');
		assert.equal(response.embeds, undefined, field);
		assert.match(response.content, /Unknown character field/, field);
	}
	character.equipment = ['A'.repeat(2_000), 'second'];
	const gear = createCharacterGetResponse(character, 'gear', 'en').embeds[0].toJSON();
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

	const summary = createCharacterGetResponse(character, null, 'en')
		.embeds[0].toJSON();
	const detailed = createCharacterGetResponse(character, 'talents', 'en')
		.embeds[0].toJSON();
	assert.match(
		summary.fields[2].value,
		/\*\*Talents\*\*\n1\. Athlete — \+1 to sustained movement\.\n2\. Cold Immunity —/,
	);
	assert.equal(detailed.description, [
		'1. Athlete — +1 to sustained movement.',
		'2. Cold Immunity — Ordinary cold cannot freeze the character.',
	].join('\n'));

	const emptyEnglish = createCharacterGetResponse(
		new Character('Empty.English', 'creator'),
		'talents',
		'en',
	).embeds[0].toJSON();
	const emptyFrench = createCharacterGetResponse(
		new Character('Empty.French', 'creator'),
		'talents',
		'fr',
	).embeds[0].toJSON();
	assert.equal(emptyEnglish.description, translations.en.common.empty);
	assert.equal(emptyFrench.description, translations.fr.common.empty);

	character.talents = ['A'.repeat(5_000)];
	const boundedSummary = createCharacterGetResponse(character, null, 'en')
		.embeds[0].toJSON();
	const boundedDetailed = createCharacterGetResponse(character, 'talents', 'en')
		.embeds[0].toJSON();
	assert.ok(boundedSummary.fields[2].value.length <= 1_024);
	assert.equal(boundedDetailed.description.length, 4_096);
	assert.match(boundedDetailed.description, /…$/);
});

test('generated character embeds have no footer', () => {
	const character = new Character('Generated.Footer.Test', 'creator');
	const embed = createGeneratedCharacterResponse(character, 'en')
		.embeds[0].toJSON();

	assert.equal(embed.footer, undefined);
});

test('embed-building source contains no footer setter calls', () => {
	const forbiddenCall = ['.set', 'Footer('].join('');
	const matches = getJavaScriptFiles(root)
		.filter(file => fs.readFileSync(file, 'utf8').includes(forbiddenCall))
		.map(file => path.relative(root, file));

	assert.deepEqual(matches, []);
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

function getJavaScriptFiles(directory) {
	return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
		if (entry.name === '.git' || entry.name === 'node_modules') {
			return [];
		}
		const entryPath = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			return getJavaScriptFiles(entryPath);
		}
		return entry.isFile() && entry.name.endsWith('.js') ? [entryPath] : [];
	});
}

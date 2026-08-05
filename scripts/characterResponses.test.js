const assert = require('node:assert/strict');
const { test } = require('node:test');

const Character = require('../models/Character');
const {
	createCharacterDamageResponse,
	createCharacterHealResponse,
	createEndTurnResponse,
} = require('../util/characterCommandResponses');
const {
	createCharacterSummaryEmbed,
	formatCharacterResource,
	formatCharacterResources,
} = require('../util/characterRenderer');

function createTestCharacter() {
	const character = new Character('Response.Test', 'creator');
	character.firstName = 'Response';
	character.resources = {
		hp: { current: 42, max: 100 },
		ar: { current: 8, max: 20 },
		ap: { current: 3, max: 5 },
		md: { current: 6, max: 8 },
	};
	return character;
}

test('shared resource formatting remains the formatting used by the general summary', () => {
	const character = createTestCharacter();
	const resources = formatCharacterResources(
		character,
		['hp', 'ar', 'ap', 'md'],
		'en',
	);
	const summaryStatus = createCharacterSummaryEmbed(character, 'en').toJSON().fields[0].value;

	assert.equal(resources, [
		'HP: **42 / 100 (42%)**',
		'❤️❤️❤️❤️🖤🖤🖤🖤🖤🖤',
		'AR: **8 / 20 (40%)**',
		'🟦🟦🟦🟦⬛⬛⬛⬛⬛⬛',
		'AP:',
		'🌟🌟🌟⭐⭐',
		'MD: **6 / 8 (75%)**',
		'🟧🟧🟧🟧🟧🟧🟧🟧⬛⬛',
	].join('\n'));
	assert.ok(summaryStatus.startsWith(`${resources}\n\n`));
});

test('damage response displays final HP before final AR without a plain final summary', () => {
	const character = createTestCharacter();
	const response = createCharacterDamageResponse({
		character,
		damage: { arDamage: 12, hpDamage: 8, piercing: false },
		damageAmount: 20,
	}, 'en');
	const resources = formatCharacterResources(character, ['hp', 'ar'], 'en');

	assert.ok(response.endsWith(resources));
	assert.ok(response.indexOf('HP:') < response.indexOf('AR:'));
	assert.equal(response.match(/HP: \*\*42 \/ 100/g)?.length, 1);
	assert.equal(response.match(/AR: \*\*8 \/ 20/g)?.length, 1);
	assert.doesNotMatch(response, /HP: \*\*42\/100|AR: \*\*8\/20/);
});

test('healing responses display only affected final resources in canonical order', () => {
	const character = createTestCharacter();
	for (const [changes, expectedIds] of [
		[[{ resource: 'hp' }], ['hp']],
		[[{ resource: 'ar' }], ['ar']],
		[[{ resource: 'ar' }, { resource: 'hp' }], ['hp', 'ar']],
	]) {
		const response = createCharacterHealResponse({
			character,
			changes,
			percentage: 50,
		}, 'en');
		assert.ok(response.endsWith(formatCharacterResources(character, expectedIds, 'en')));
		assert.doesNotMatch(response, /→/);
	}
});

test('end-turn response displays final AP before localized MD or DD', () => {
	const character = createTestCharacter();
	for (const locale of ['en', 'fr']) {
		const response = createEndTurnResponse({ character }, locale);
		const resources = formatCharacterResources(character, ['ap', 'md'], locale);
		assert.ok(response.endsWith(resources));
		assert.ok(response.indexOf(locale === 'fr' ? 'PA:' : 'AP:')
			< response.indexOf(locale === 'fr' ? 'DD:' : 'MD:'));
		assert.doesNotMatch(response, /with 3 AP and 6 MD|avec 3 PA et 6 DD/);
	}
});

test('shared resource formatter uses English and French resource labels', () => {
	const character = createTestCharacter();
	assert.match(formatCharacterResource(character, 'hp', 'en'), /^HP:/);
	assert.match(formatCharacterResource(character, 'ar', 'en'), /^AR:/);
	assert.match(formatCharacterResource(character, 'ap', 'en'), /^AP:/);
	assert.match(formatCharacterResource(character, 'md', 'en'), /^MD:/);
	assert.match(formatCharacterResource(character, 'hp', 'fr'), /^PV:/);
	assert.match(formatCharacterResource(character, 'ar', 'fr'), /^PR:/);
	assert.match(formatCharacterResource(character, 'ap', 'fr'), /^PA:/);
	assert.match(formatCharacterResource(character, 'md', 'fr'), /^DD:/);
});

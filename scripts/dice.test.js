const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
const {
	DEFAULT_DICE_LIMITS,
	DiceExpressionError,
	parseDiceExpression,
} = require('../services/diceParser');
const { rollDice } = require('../services/diceRoller');
const { rollDiceExpression } = require('../services/diceRollService');
const { t } = require('../util/i18n');
const rollCommand = require('../commands/handlers/roll');

test('dice parser accepts and normalizes supported expressions', () => {
	assert.deepEqual(parseDiceExpression('1d20'), {
		count: 1,
		sides: 20,
		modifier: 0,
		normalized: '1d20',
	});
	assert.deepEqual(parseDiceExpression('2D06+03'), {
		count: 2,
		sides: 6,
		modifier: 3,
		normalized: '2d6+3',
	});
	assert.deepEqual(parseDiceExpression('4d8-2'), {
		count: 4,
		sides: 8,
		modifier: -2,
		normalized: '4d8-2',
	});
});

test('dice parser rejects malformed or unsupported expressions', () => {
	for (const expression of [
		'', 'd20', '1d', '1 d20', '1d20 ', '2d6++3', '2d6+3+1',
		'2d6kh1', '2d6!', '2d6r1', '(2d6)', '1d6+1d4',
	]) {
		assert.throws(
			() => parseDiceExpression(expression),
			error => error instanceof DiceExpressionError && error.code === 'INVALID_FORMAT',
			expression,
		);
	}
});

test('dice parser rejects invalid values and enforces configured limits', () => {
	for (const [expression, code] of [
		['0d20', 'DICE_COUNT_OUT_OF_RANGE'],
		['1d1', 'DICE_SIDES_OUT_OF_RANGE'],
		['101d6', 'DICE_COUNT_OUT_OF_RANGE'],
		['1d1001', 'DICE_SIDES_OUT_OF_RANGE'],
		['1d20+10001', 'MODIFIER_OUT_OF_RANGE'],
		['1d20-10001', 'MODIFIER_OUT_OF_RANGE'],
	]) {
		assert.throws(() => parseDiceExpression(expression), error => error.code === code);
	}

	const limits = { maxDice: 2, maxSides: 12, maxModifier: 5 };
	assert.deepEqual(parseDiceExpression('2d12+5', limits), {
		count: 2,
		sides: 12,
		modifier: 5,
		normalized: '2d12+5',
	});
	for (const expression of ['3d12', '2d13', '2d12+6']) {
		assert.throws(() => parseDiceExpression(expression, limits));
	}
});

test('dice roller returns each die, the modifier, and the final total', () => {
	const randomValues = [0.75, 0.25];
	const result = rollDice(
		parseDiceExpression('2d6+3'),
		() => randomValues.shift(),
	);
	assert.deepEqual(result, {
		count: 2,
		sides: 6,
		modifier: 3,
		normalized: '2d6+3',
		rolls: [5, 2],
		total: 10,
	});
});

test('dice errors and result labels are localized', () => {
	for (const locale of ['en', 'fr']) {
		for (const key of [
			'invalidFormat',
			'diceCount',
			'diceSides',
			'modifier',
		]) {
			const message = t(locale, `rpg.roll.errors.${key}`, DEFAULT_DICE_LIMITS);
			assert.notEqual(message, `rpg.roll.errors.${key}`);
			assert.equal(message.includes('{{'), false);
		}
	}
	assert.equal(
		t('en', 'rpg.roll.result', {
			expression: '2d6+3',
			modifier: '+3',
			rolls: '5, 2',
			total: 10,
		}),
		'**2d6+3**\n\nRolls: 5, 2\nModifier: +3\nTotal: **10**',
	);
	assert.equal(
		t('fr', 'rpg.roll.result', {
			expression: '2d6+3',
			modifier: '+3',
			rolls: '5, 2',
			total: 10,
		}),
		'**2d6+3**\n\nLancers : 5, 2\nModificateur : +3\nTotal : **10**',
	);
});

test('roll command returns a localized private validation error', async () => {
	let reply;
	await rollCommand.execute({
		config: { locale: 'fr' },
		interaction: {
			guildId: 'guild',
			options: {
				getString: () => '2d6kh1',
			},
			reply: value => {
				reply = value;
			},
		},
	});

	assert.match(reply.content, /^Expression de dés invalide\./);
	assert.equal(reply.flags.toString(), '64');
});

test('roll command uses GIF-only replies exclusively for 1d2 and 1d20', async () => {
	assert.deepEqual(rollDiceExpression('1d2', { random: () => 0 }), {
		animationFileName: 'HEADS.gif',
		result: {
			count: 1,
			sides: 2,
			modifier: 0,
			normalized: '1d2',
			rolls: [1],
			total: 1,
		},
		type: 'animation',
	});
	assert.equal(
		rollDiceExpression('1d20', { random: () => 0.95 }).animationFileName,
		'D20-20.gif',
	);
	assert.equal(
		rollDiceExpression('1d20+1', { random: () => 0.95 }).type,
		'text',
	);
	assert.equal(
		rollDiceExpression('2d2', { random: () => 0.95 }).type,
		'text',
	);

	const coinReply = await executeRollCommand('1d2');
	assert.deepEqual(Object.keys(coinReply), ['files']);
	assert.match(path.basename(coinReply.files[0].attachment), /^(?:HEADS|TAILS)\.gif$/);
	const modifiedReply = await executeRollCommand('1d20+1');
	assert.equal(typeof modifiedReply, 'string');
});

async function executeRollCommand(expression) {
	let reply;
	await rollCommand.execute({
		config: { locale: 'en' },
		interaction: {
			guildId: 'guild',
			options: {
				getString: () => expression,
			},
			reply: value => {
				reply = value;
			},
		},
	});
	return reply;
}

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
	randomIndex,
	randomInteger,
	readNormalizedRandom,
} = require('../services/random');

test('normalized random values preserve the existing clamp boundaries', () => {
	for (const [value, expected] of [
		[Number.NEGATIVE_INFINITY, 0],
		[-0.1, 0],
		[0, 0],
		[0.5, 0.5],
		[0.9999999999999999, 0.9999999999999999],
		[1, 0.9999999999999999],
		[Number.POSITIVE_INFINITY, 0.9999999999999999],
	]) {
		let calls = 0;
		assert.equal(readNormalizedRandom(() => {
			calls += 1;
			return value;
		}), expected);
		assert.equal(calls, 1);
	}
});

test('random index and inclusive integer helpers consume one normalized value', () => {
	let calls = 0;
	assert.equal(randomIndex(4, () => {
		calls += 1;
		return 1;
	}), 3);
	assert.equal(calls, 1);

	assert.equal(randomInteger(3, 7, () => {
		calls += 1;
		return -1;
	}), 3);
	assert.equal(calls, 2);
});

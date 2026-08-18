const MAX_NORMALIZED_RANDOM_VALUE = 0.9999999999999999;

function readNormalizedRandom(random = Math.random) {
	return Math.max(0, Math.min(MAX_NORMALIZED_RANDOM_VALUE, random()));
}

function randomIndex(length, random = Math.random) {
	return Math.floor(readNormalizedRandom(random) * length);
}

function randomInteger(minimum, maximum, random = Math.random) {
	return minimum + randomIndex(maximum - minimum + 1, random);
}

module.exports = {
	randomIndex,
	randomInteger,
	readNormalizedRandom,
};

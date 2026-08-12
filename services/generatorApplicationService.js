const generatorResolver = require('./generatorResolver');

const DEFAULT_GENERATOR_COUNT = 1;
const MIN_GENERATOR_COUNT = 1;
const MAX_GENERATOR_COUNT = 10;

function generateGeneratorResults(
	generatorId,
	locale = 'en',
	options = {},
	resolver = generatorResolver,
) {
	if (!options || typeof options !== 'object' || Array.isArray(options)) {
		throw new TypeError('Generator batch options must be an object.');
	}
	const count = options.count ?? DEFAULT_GENERATOR_COUNT;
	if (
		!Number.isInteger(count)
		|| count < MIN_GENERATOR_COUNT
		|| count > MAX_GENERATOR_COUNT
	) {
		throw new TypeError(
			`Generator count must be an integer from ${MIN_GENERATOR_COUNT}`
			+ ` to ${MAX_GENERATOR_COUNT}.`,
		);
	}
	const generationOptions = { ...options };
	delete generationOptions.count;
	return Array.from({ length: count }, () => resolver.generate(
		generatorId,
		locale,
		generationOptions,
	));
}

module.exports = {
	DEFAULT_GENERATOR_COUNT,
	MAX_GENERATOR_COUNT,
	MIN_GENERATOR_COUNT,
	generateGeneratorResults,
};

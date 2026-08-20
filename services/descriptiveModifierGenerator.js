const { readNormalizedRandom } = require('./random');

const DESCRIPTIVE_MODIFIER_CHANCE = 0.25;

function maybeGenerateDescriptiveModifiers({
	generator = 'modifier_character',
	resolver,
	locale = 'en',
	random = Math.random,
	path = 'root.descriptiveModifier',
	resolverOptions = {},
}) {
	if (readNormalizedRandom(random) >= DESCRIPTIVE_MODIFIER_CHANCE) {
		return [];
	}
	return [generateDescriptiveModifier({
		generator,
		resolver,
		locale,
		random,
		path,
		resolverOptions,
	})];
}

function generateDescriptiveModifier({
	generator = 'modifier_character',
	resolver,
	locale = 'en',
	random = Math.random,
	path = 'root.descriptiveModifier',
	resolverOptions = {},
}) {
	if (typeof resolver?.resolveReference !== 'function') {
		throw new TypeError('Descriptive modifier generation requires a resolver.');
	}
	const resolved = resolver.resolveReference(
		generator,
		locale,
		{ ...resolverOptions, path, random },
	);
	const fields = resolved?.displayFields ?? resolved?.fields;
	if (
		typeof resolved?.generatorId === 'string'
		&& typeof resolved.entryId === 'string'
		&& typeof fields?.name === 'string'
		&& typeof fields.description === 'string'
	) {
		return {
			generatorId: resolved.generatorId,
			entryId: resolved.entryId,
			name: fields.name,
			description: fields.description,
			provenance: resolved.provenance ?? [],
		};
	}
	throw new Error('The descriptive modifier generator returned an invalid result.');
}

module.exports = {
	DESCRIPTIVE_MODIFIER_CHANCE,
	generateDescriptiveModifier,
	maybeGenerateDescriptiveModifiers,
};

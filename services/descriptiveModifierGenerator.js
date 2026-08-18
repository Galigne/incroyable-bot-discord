const { readNormalizedRandom } = require('./random');

const DESCRIPTIVE_MODIFIER_CHANCE = 0.25;

function maybeGenerateDescriptiveModifiers({
	generator = 'modifier_character',
	resolver,
	locale = 'en',
	random = Math.random,
	path = 'root.descriptiveModifier',
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
	})];
}

function generateDescriptiveModifier({
	generator = 'modifier_character',
	resolver,
	locale = 'en',
	random = Math.random,
	path = 'root.descriptiveModifier',
}) {
	if (typeof resolver?.resolveReference !== 'function') {
		throw new TypeError('Descriptive modifier generation requires a resolver.');
	}
	const resolved = resolver.resolveReference(
		{
			generator,
			select: 'fields',
		},
		locale,
		{ path, random },
	);
	const fields = resolved?.fields;
	if (typeof fields?.name === 'string' && typeof fields.description === 'string') {
		const selection = resolved.provenance?.find(record => (
			record.type === 'entry' && record.generatorId && record.entryId
		));
		return {
			generatorId: selection?.generatorId ?? generator,
			entryId: selection?.entryId,
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

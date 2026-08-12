const DESCRIPTIVE_MODIFIER_CHANCE = 0.25;

function maybeGenerateDescriptiveModifiers({
	resolver,
	locale = 'en',
	random = Math.random,
	path = 'root.descriptiveModifier',
}) {
	if (readRandom(random) >= DESCRIPTIVE_MODIFIER_CHANCE) {
		return [];
	}
	return [generateDescriptiveModifier({ resolver, locale, random, path })];
}

function generateDescriptiveModifier({
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
			generator: 'modifier',
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
			generatorId: selection?.generatorId ?? 'modifier',
			entryId: selection?.entryId,
			name: fields.name,
			description: fields.description,
			provenance: resolved.provenance ?? [],
		};
	}
	throw new Error('The descriptive modifier generator returned an invalid result.');
}

function readRandom(random) {
	return Math.max(0, Math.min(0.9999999999999999, random()));
}

module.exports = {
	DESCRIPTIVE_MODIFIER_CHANCE,
	generateDescriptiveModifier,
	maybeGenerateDescriptiveModifiers,
};

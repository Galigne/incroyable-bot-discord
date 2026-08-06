const { generatorResolutionError } = require('./generatorResolutionError');
const { selectWeightedEntry } = require('./weightedSelector');

function createModifierResolver({ getGenerator }) {
	if (typeof getGenerator !== 'function') {
		throw new TypeError('Modifier resolution requires generator lookup.');
	}

	function resolveModifierRequests(
		requests,
		targetGeneratorId,
		locale,
		{ random = Math.random, path = 'root.modifiers' } = {},
	) {
		const records = [];
		for (let requestIndex = 0; requestIndex < (requests ?? []).length; requestIndex += 1) {
			const request = requests[requestIndex];
			const requestPath = `${path}.${requestIndex}`;
			const modifierGenerator = getGenerator(request.generator, locale);
			validateCompatibility(modifierGenerator, targetGeneratorId);
			if (readRandom(random) >= request.chance) {
				continue;
			}
			const count = selectInclusiveCount(request.count, random);
			if (count > modifierGenerator.entries.length) {
				throw generatorResolutionError(
					'GENERATOR_MODIFIER_COUNT_UNAVAILABLE',
					'The modifier request exceeds the available unique entries.',
				);
			}
			const candidates = [...modifierGenerator.entries];
			for (let selectionIndex = 0; selectionIndex < count; selectionIndex += 1) {
				const entry = selectWeightedEntry(candidates, random);
				candidates.splice(candidates.indexOf(entry), 1);
				records.push(createModifierRecord(
					modifierGenerator,
					entry,
					`${requestPath}.entries.${selectionIndex}`,
				));
			}
		}
		return records;
	}

	return {
		resolveModifierRequests,
	};
}

function validateCompatibility(generator, targetGeneratorId) {
	if (!generator || generator.kind !== 'modifier') {
		throw generatorResolutionError(
			'GENERATOR_MODIFIER_MISSING',
			'The requested modifier generator is unavailable.',
		);
	}
	if (!generator.appliesTo.includes(targetGeneratorId)) {
		throw generatorResolutionError(
			'GENERATOR_MODIFIER_INCOMPATIBLE',
			'The modifier generator is incompatible with this result.',
		);
	}
}

function selectInclusiveCount(count, random) {
	if (count.min === count.max) {
		return count.min;
	}
	return count.min + Math.floor(readRandom(random) * (count.max - count.min + 1));
}

function createModifierRecord(generator, entry, path) {
	return {
		generatorId: generator.id,
		entryId: entry.id,
		name: entry.fields.Name,
		description: entry.fields.Description,
		provenance: [{
			type: 'entry',
			selection: 'random',
			generatorId: generator.id,
			entryId: entry.id,
			path,
		}],
	};
}

function readRandom(random) {
	return Math.max(0, Math.min(0.9999999999999999, random()));
}

module.exports = {
	createModifierResolver,
};

const {
	getStatProfile,
	listStatProfiles,
} = require('../../services/statProfileCatalog');
const {
	getEntryWeight,
	selectWeightedEntry,
} = require('../../services/weightedSelector');
const generatorResolver = require('../../services/generatorResolver');
const {
	DEFAULT_STAT_PROFILE_ID,
} = require('../../services/generationMetadata');
const {
	isGeneratorRouter,
	validateGeneratorApplicationContracts,
} = require('../../services/generatorSchema');

module.exports = function createGeneratorChecks(context) {
	const {
		errors,
		generatorCatalog,
	} = context;

	function checkGeneratorCatalog() {
		try {
			const publicGenerators = generatorCatalog.listGenerators('en');
			const allGenerators = generatorCatalog.listGenerators('en', {
				visibility: 'all',
			});
			const internalGenerators = generatorCatalog.listGenerators('en', {
				visibility: 'internal',
			});
			if (
				publicGenerators.length === 0
				|| allGenerators.length !== publicGenerators.length + internalGenerators.length
			) {
				errors.push('Generator v4 visibility filtering is incorrect.');
			}

			checkLocalePairing(generatorCatalog, allGenerators);
			checkVisibilityBehavior(generatorCatalog, publicGenerators, internalGenerators);
			checkWeightedSelection(errors);
			validateGeneratorApplicationContracts(createCatalogMap(generatorCatalog));
			checkRouterSmoke(generatorCatalog, allGenerators);
			checkGeneratorResponses(errors);
			checkStatProfiles(errors);
		}
		catch (error) {
			errors.push(`Generator catalog: ${error.message}`);
		}
	}

	return {
		checkGeneratorCatalog,
	};
};

function checkLocalePairing(generatorCatalog, englishGenerators) {
	const englishIds = englishGenerators.map(generator => generator.id);
	const frenchIds = generatorCatalog.listGenerators('fr', { visibility: 'all' })
		.map(generator => generator.id);
	if (JSON.stringify([...englishIds].sort()) !== JSON.stringify([...frenchIds].sort())) {
		throw new Error('English and French catalogs do not expose the same stable IDs.');
	}
	for (const generator of englishGenerators) {
		const english = generatorCatalog.getGenerator(generator.id, 'en');
		const french = generatorCatalog.getGenerator(generator.id, 'fr');
		if (
			english === french
			|| english?.id !== generator.id
			|| french?.id !== generator.id
			|| JSON.stringify(english.entries.map(entry => entry.id).sort())
				!== JSON.stringify(french.entries.map(entry => entry.id).sort())
		) {
			throw new Error(`Generator ${generator.id} is not paired and cached by stable ID.`);
		}
	}
}

function checkVisibilityBehavior(generatorCatalog, publicGenerators, internalGenerators) {
	for (const generator of publicGenerators) {
		const result = generatorResolver.generate(generator.id, 'en', {
			random: () => 0,
		});
		if (result?.entryId !== generator.entries[0].id) {
			throw new Error(`Generator ${generator.id} cannot select its first entry.`);
		}
	}
	for (const generator of internalGenerators) {
		if (
			generatorCatalog.getGenerator(generator.id, 'en') !== generator
			|| generatorResolver.generate(generator.id, 'en', { random: () => 0 }) !== null
		) {
			throw new Error(`Internal generator ${generator.id} has invalid visibility behavior.`);
		}
	}
}

function checkWeightedSelection(errors) {
	const entries = [
		{ id: 'default-weight', name: 'Default weight' },
		{ id: 'double-weight', name: 'Double weight', weight: 2 },
	];
	if (
		getEntryWeight(entries[0]) !== 1
		|| getEntryWeight(entries[1]) !== 2
		|| selectWeightedEntry(entries, () => 0) !== entries[0]
		|| selectWeightedEntry(entries, () => 0.5) !== entries[1]
	) {
		errors.push('Weighted generator selection is not working correctly.');
	}
}

function checkRouterSmoke(generatorCatalog, generators) {
	for (const generator of generators.filter(isGeneratorRouter)) {
		for (const route of generator.entries) {
			const result = generatorResolver.generate(
				`${generator.id}:${route.id}`,
				'en',
				{ random: () => 0.5 },
			);
			if (!result?.entryId) {
				throw new Error(`Structural route ${generator.id}:${route.id} did not resolve.`);
			}
		}
	}
}

function checkGeneratorResponses(errors) {
	const { createGeneratedEmbed } = require('../../util/generatorResponses');
	const structuredEmbed = createGeneratedEmbed({
		generatorName: 'Fixture',
		outputType: 'fields',
		displayFields: {
			name: 'Fixture name',
			description: 'Fixture description',
		},
		modifiers: [],
	}).toJSON();
	if (
		structuredEmbed.fields?.[0]?.name !== 'Name'
		|| structuredEmbed.fields?.[1]?.name !== 'Description'
	) {
		errors.push('Structured generator fields are not rendered correctly.');
	}
	const weightedTextEmbed = createGeneratedEmbed({
		generatorName: 'Fixture',
		outputType: 'value',
		value: 'Weighted fixture value',
		modifiers: [],
	}).toJSON();
	if (weightedTextEmbed.description !== 'Weighted fixture value') {
		errors.push('Weighted name-only generator entries are not rendered correctly.');
	}
}

function checkStatProfiles(errors) {
	const profiles = listStatProfiles();
	const defaultProfile = getStatProfile(DEFAULT_STAT_PROFILE_ID);
	if (
		profiles.length === 0
		|| profiles.filter(profile => profile.id === DEFAULT_STAT_PROFILE_ID).length !== 1
		|| defaultProfile !== getStatProfile(DEFAULT_STAT_PROFILE_ID)
	) {
		errors.push('The default statistical profile is missing or is not cached.');
	}
}

function createCatalogMap(generatorCatalog) {
	return new Map([
		['en', new Map(generatorCatalog.listGenerators('en', { visibility: 'all' })
			.map(generator => [generator.id, generator]))],
		['fr', new Map(generatorCatalog.listGenerators('fr', { visibility: 'all' })
			.map(generator => [generator.id, generator]))],
	]);
}
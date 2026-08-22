const {
	BACKGROUND_ROUTER_ID,
	CREATURE_ROUTER_ID,
	GENERATOR_SCHEMA_VERSION,
} = require('./generatorSchema/constants');
const {
	validateBackgroundStatProfileRelationships,
} = require('./generatorSchema/backgroundRelationshipValidation');
const {
	validateCreatureStatProfileRelationships,
} = require('./generatorSchema/creatureRelationshipValidation');
const {
	validateGeneratorDefinition,
} = require('./generatorSchema/envelopeValidation');
const {
	validateGeneratorPair,
} = require('./generatorSchema/parityValidation');
const {
	validateGeneratorRelationships,
} = require('./generatorSchema/relationshipValidation');
const {
	validateRoutedArchetypeStatProfileRelationships,
} = require('./generatorSchema/routedArchetypeValidation');
const {
	isGeneratorRouter,
} = require('./generatorSchema/routerValidation');
const {
	ARMOR_PERCENTAGES,
} = require('./mechanics/armor');
const {
	generatorSchemaError,
} = require('./generatorSchema/assertions');

const CORE_GENERATOR_CONTRACTS = Object.freeze({
	name: { visibility: 'public', required: ['first_name', 'last_name'], minimumEntries: 1 },
	race: {
		visibility: 'public',
		required: ['description', 'skill_bonus', 'physical_ability'],
		minimumEntries: 1,
	},
	personality: { visibility: 'public', required: ['description'], minimumEntries: 2 },
	rules: { visibility: 'public', required: ['description'], minimumEntries: 2 },
	talents: { visibility: 'public', required: ['description'], minimumEntries: 4 },
	status_effect: { visibility: 'public', required: ['description'], minimumEntries: 1 },
	physical_description: {
		visibility: 'internal',
		required: ['description'],
		minimumEntries: 1,
	},
	armors: { visibility: 'internal', required: ['type', 'description'], minimumEntries: 1 },
	weapons: { visibility: 'internal', required: ['description'], minimumEntries: 1 },
	shields: { visibility: 'internal', required: ['description'], minimumEntries: 1 },
	modifier_character: {
		visibility: 'internal',
		required: ['description'],
		minimumEntries: 1,
	},
	modifier_creature: {
		visibility: 'internal',
		required: ['description'],
		minimumEntries: 1,
	},
	modifier_rarity: { visibility: 'internal', required: [], minimumEntries: 1 },
});

const ROUTER_CONTRACTS = Object.freeze([
	{ id: 'background', visibility: 'public' },
	{ id: 'creature', visibility: 'public' },
	{ id: 'loot', visibility: 'public' },
]);

function validateGeneratorApplicationContracts(catalogs) {
	if (!(catalogs instanceof Map)) {
		throw new TypeError('Generator application contract validation requires catalogs.');
	}
	for (const locale of ['en', 'fr']) {
		const catalog = catalogs.get(locale);
		if (!(catalog instanceof Map)) {
			throw new TypeError(`Generator application contracts are missing the ${locale} catalog.`);
		}
		for (const [generatorId, contract] of Object.entries(CORE_GENERATOR_CONTRACTS)) {
			validateCoreGenerator(catalog, locale, generatorId, contract);
		}
		for (const contract of ROUTER_CONTRACTS) {
			validateRouter(catalog, locale, contract);
		}
		validateArmorGenerator(catalog, locale);
		validateRarityGenerator(catalog, locale);
	}
	return true;
}

function validateCoreGenerator(catalog, locale, generatorId, contract) {
	const generator = requireGenerator(catalog, locale, generatorId, contract.visibility);
	if (
		JSON.stringify(generator.entrySchema.required)
			!== JSON.stringify(contract.required)
		|| generator.entries.length < contract.minimumEntries
	) {
		throw applicationContractError(
			'INVALID_GENERATOR_APPLICATION_SCHEMA',
			`${locale}:${generatorId} does not provide the required application schema.`,
		);
	}
	if (generatorId !== 'armors') {
		assertStringFields(generator, locale);
	}
}

function validateRouter(catalog, locale, contract) {
	const generator = requireGenerator(catalog, locale, contract.id, contract.visibility);
	if (!isGeneratorRouter(generator)) {
		throw applicationContractError(
			'INVALID_GENERATOR_APPLICATION_ROUTER',
			`${locale}:${contract.id} must remain a public structural router.`,
		);
	}
}

function validateArmorGenerator(catalog, locale) {
	const generator = requireGenerator(catalog, locale, 'armors', 'internal');
	const supportedTypes = new Set(Object.keys(ARMOR_PERCENTAGES));
	for (const generatorId of ['armors', 'shields']) {
		if (catalog.get(generatorId)?.modifiers?.modifier_rarity !== 100) {
			throw applicationContractError(
				'INVALID_RARITY_APPLICATION_RELATIONSHIP',
				`${locale}:${generatorId} must resolve modifier_rarity at 100 percent.`,
			);
		}
	}
	if (!generator.entries.some(entry => entry.fields.type === 'light')) {
		throw applicationContractError(
			'MISSING_LIGHT_ARMOR',
			`${locale}:armors must contain at least one light armor for character generation.`,
		);
	}
	if (generator.entries.some(entry => (
		typeof entry.fields.type !== 'string'
		|| !supportedTypes.has(entry.fields.type)
		|| typeof entry.fields.description !== 'string'
	))) {
		throw applicationContractError(
			'INVALID_ARMOR_APPLICATION_FIELDS',
			`${locale}:armors contains a type or description unsupported by mechanics.`,
		);
	}
}

function validateRarityGenerator(catalog, locale) {
	const generator = requireGenerator(catalog, locale, 'modifier_rarity', 'internal');
	const expectedIds = Object.keys(ARMOR_PERCENTAGES.light).sort();
	const actualIds = generator.entries.map(entry => entry.id).sort();
	if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
		throw applicationContractError(
			'INVALID_RARITY_APPLICATION_IDS',
			`${locale}:modifier_rarity must expose exactly the stable armor rarity IDs.`,
		);
	}
}

function assertStringFields(generator, locale) {
	for (const entry of generator.entries) {
		if (Object.values(entry.fields ?? {}).some(value => (
			typeof value !== 'string' || !value.trim()
		))) {
			throw applicationContractError(
				'INVALID_GENERATOR_APPLICATION_TEXT',
				`${locale}:${generator.id}:${entry.id} contains a non-text application field.`,
			);
		}
	}
}

function requireGenerator(catalog, locale, generatorId, visibility) {
	const generator = catalog.get(generatorId);
	if (!generator || generator.visibility !== visibility) {
		throw applicationContractError(
			'MISSING_GENERATOR_APPLICATION_CONTRACT',
			`${locale}:${generatorId} is missing or has invalid visibility.`,
		);
	}
	return generator;
}

function applicationContractError(code, message) {
	return generatorSchemaError(code, message);
}

module.exports = {
	BACKGROUND_ROUTER_ID,
	CORE_GENERATOR_CONTRACTS,
	CREATURE_ROUTER_ID,
	GENERATOR_SCHEMA_VERSION,
	ROUTER_CONTRACTS,
	isGeneratorRouter,
	validateBackgroundStatProfileRelationships,
	validateCreatureStatProfileRelationships,
	validateGeneratorApplicationContracts,
	validateGeneratorDefinition,
	validateGeneratorPair,
	validateGeneratorRelationships,
	validateRoutedArchetypeStatProfileRelationships,
};

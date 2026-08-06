const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ffmpegPath = require('ffmpeg-static');
const { generateDependencyReport } = require('@discordjs/voice');
const config = require('../config.json');
const {
	createTemporaryEntityStorage,
	removeTemporaryEntityStorage,
} = require('./checks/helpers');

const root = path.join(__dirname, '..');
const testEntityStorage = createTemporaryEntityStorage();
process.env.INCREDIBLE_BOT_SAVE_DIRECTORY = testEntityStorage;

const Character = require('../models/Character');
const { BASE_STATS: BASE_STAT_NAMES } = require('../services/mechanics/constants');
const characterStore = require('../services/characterStore');
const {
	getEditableFieldValue,
	setEditableFieldValue,
} = require('../services/characterEditor');
const { dealDamage } = require('../services/mechanics/damage');
const {
	calculateMaxAp,
	calculateMaxHp,
	calculateMaxMovementDistance,
	resetTurnResources,
	restoreResource,
} = require('../services/mechanics/resources');
const generatorCatalog = require('../services/generatorCatalog');
const {
	populateRandomCharacter,
} = require('../services/randomCharacterGenerator');
const {
	allocateRuleLevels,
	calculateRulePoints,
	calculateStatBudget,
	calculateStatCost,
} = require('../services/mechanics/characterGeneration');
const {
	authorizeCommand,
	canManageEntity,
	hasDmPermission,
	hasModeratorPermission,
	isGuildOwner,
} = require('../util/authorization');
const { validateConfig } = require('../util/configuration');
const createAuthorizationChecks = require('./checks/authorization');
const createCharacterChecks = require('./checks/characters');
const createCommandChecks = require('./checks/commands');
const createGeneratorChecks = require('./checks/generators');
const createInteractionChecks = require('./checks/interactions');
const createLocalizationChecks = require('./checks/localization');
const createRuntimeChecks = require('./checks/runtime');

const errors = [];
const context = {
	BASE_STAT_NAMES,
	Character,
	allocateRuleLevels,
	authorizeCommand,
	canManageEntity,
	calculateMaxAp,
	calculateMaxHp,
	calculateMaxMovementDistance,
	calculateRulePoints,
	calculateStatBudget,
	calculateStatCost,
	characterStore,
	config,
	dealDamage,
	errors,
	ffmpegPath,
	fs,
	generatorCatalog,
	getEditableFieldValue,
	hasDmPermission,
	hasModeratorPermission,
	isGuildOwner,
	path,
	populateRandomCharacter,
	resetTurnResources,
	restoreResource,
	root,
	setEditableFieldValue,
	spawnSync,
	validateConfig,
};

async function main() {
	const runtimeChecks = createRuntimeChecks(context);
	const commandChecks = createCommandChecks(context);
	const generatorChecks = createGeneratorChecks(context);
	const characterChecks = createCharacterChecks(context);
	const interactionChecks = createInteractionChecks(context);
	const authorizationChecks = createAuthorizationChecks(context);
	const localizationChecks = createLocalizationChecks(context);

	try {
		runtimeChecks.checkNodeVersion();
		runtimeChecks.checkArchitectureBoundaries();
		localizationChecks.checkLocalization();
		const commands = commandChecks.checkCommands();
		commandChecks.checkHelpOrder(commands.values(), 'top-level commands');
		commandChecks.checkRpgTopLevelCommands(commands);
		commandChecks.checkSlashCommandData(commands);
		generatorChecks.checkGeneratorCatalog();
		characterChecks.checkCharacterModel();
		characterChecks.checkRandomCharacterGeneration();
		await characterChecks.checkCharacterStore();
		await interactionChecks.checkEntityInteractions();
		runtimeChecks.checkConfiguration();
		authorizationChecks.checkAuthorization(commands);
		runtimeChecks.checkRequiredFiles();

		if (errors.length > 0) {
			console.error(errors.join('\n\n'));
			process.exitCode = 1;
		}
		else {
			console.log(`Checks passed: ${commands.size} commands loaded.`);
			console.log(generateDependencyReport());
		}
	}
	finally {
		removeTemporaryEntityStorage(testEntityStorage);
	}
}

main().catch(error => {
	console.error(error);
	process.exitCode = 1;
});

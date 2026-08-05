const {
	assertSuccessfulRegistration,
	registerCommands,
} = require('../adapters/discordCommandRegistration');
const { reconnectClient } = require('../adapters/discordClientLifecycle');
const { disconnectVoiceResources } = require('../adapters/localAudioPlayer');
const commandRegistry = require('../commands/registry');
const { reloadGenerationData } = require('../services/generationData');
const { reloadConfig } = require('../util/configuration');
const { getLocale, reloadTranslations } = require('../util/i18n');

const RELOAD_STAGES = Object.freeze([
	'configuration',
	'localizations',
	'generators',
	'commands',
	'registration',
	'voiceCleanup',
	'discordReconnect',
]);

function createRuntimeReloader({
	catalogPaths,
	client,
	configPath,
	logger = console,
	operations = {},
	runtimeState,
	token,
}) {
	const stageOperations = {
		configuration: () => reloadConfig(runtimeState, configPath),
		localizations: () => reloadTranslations(catalogPaths),
		generators: () => reloadGenerationData(),
		commands: () => commandRegistry.reloadCommandRegistry(runtimeState),
		registration: async () => assertSuccessfulRegistration(
			await registerCommands(
				client,
				runtimeState.getCommandRegistry(),
				{ logger },
			),
		),
		voiceCleanup: () => disconnectVoiceResources(),
		discordReconnect: () => reconnectClient(client, token),
		...operations,
	};
	let activeReload = null;

	function reload() {
		if (!activeReload) {
			activeReload = runStages().finally(() => {
				activeReload = null;
			});
		}
		return activeReload;
	}

	async function runStages() {
		const stages = [];
		for (const id of RELOAD_STAGES) {
			try {
				await stageOperations[id]();
				stages.push({ id, success: true });
			}
			catch (error) {
				logger.error(`[reload] ${id} failed:`, error);
				stages.push({ id, success: false });
			}
		}
		return {
			locale: getLocale(runtimeState.getConfig()),
			stages,
			success: stages.every(stage => stage.success),
		};
	}

	return { reload };
}

module.exports = {
	RELOAD_STAGES,
	createRuntimeReloader,
};

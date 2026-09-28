const fs = require('node:fs/promises');
const path = require('node:path');
const { writeJsonAtomically } = require('../services/atomicJsonFile');
const {
	CURRENT_CHARACTER_SAVE_SCHEMA_VERSION,
	validateCharacterSaveSchema,
} = require('../services/characterSaveSchema');
const {
	CURRENT_CREATURE_SAVE_SCHEMA_VERSION,
	validateCreatureSaveSchema,
} = require('../services/creatureSaveSchema');

const DEFAULT_SAVE_ROOT = path.join(__dirname, '..', 'save');
const MIGRATION_CONFIG = Object.freeze({
	character: Object.freeze({
		currentVersion: CURRENT_CHARACTER_SAVE_SCHEMA_VERSION,
		entityProperty: 'character',
		previousVersion: CURRENT_CHARACTER_SAVE_SCHEMA_VERSION - 1,
		validate: validateCharacterSaveSchema,
	}),
	creature: Object.freeze({
		currentVersion: CURRENT_CREATURE_SAVE_SCHEMA_VERSION,
		entityProperty: 'creature',
		previousVersion: CURRENT_CREATURE_SAVE_SCHEMA_VERSION - 1,
		validate: validateCreatureSaveSchema,
	}),
});

async function migrateSevenStatisticsSaves(saveRoot = DEFAULT_SAVE_ROOT) {
	const preparedFiles = [];
	let snapshotsUpdated = 0;

	for (const entityType of Object.keys(MIGRATION_CONFIG)) {
		const entityDirectory = path.join(saveRoot, `${entityType}s`);
		for (const filePath of await listJsonFiles(entityDirectory)) {
			const prepared = await prepareActiveSave(filePath, entityType);
			preparedFiles.push(prepared);
			snapshotsUpdated += prepared.snapshotsUpdated;
		}
		for (const filePath of await listJsonFiles(path.join(entityDirectory, '.history'))) {
			const prepared = await prepareHistory(filePath, entityType);
			preparedFiles.push(prepared);
			snapshotsUpdated += prepared.snapshotsUpdated;
		}
	}

	const changedFiles = preparedFiles.filter(file => file.changed);
	for (const file of changedFiles) {
		await writeJsonAtomically(file.path, file.value);
	}

	return {
		filesScanned: preparedFiles.length,
		filesUpdated: changedFiles.length,
		snapshotsUpdated,
	};
}

async function prepareActiveSave(filePath, entityType) {
	const value = await readJson(filePath);
	const entityKey = path.basename(filePath, '.json');
	const migrated = migrateEntitySnapshot(value, entityType, entityKey);
	return {
		changed: migrated.changed,
		path: filePath,
		snapshotsUpdated: migrated.changed ? 1 : 0,
		value: migrated.value,
	};
}

async function prepareHistory(filePath, entityType) {
	const document = await readJson(filePath);
	if (!isRecord(document) || !Array.isArray(document.entries)) {
		throw new TypeError(`Invalid ${entityType} history document: ${filePath}`);
	}
	const entityKey = path.basename(filePath, '.json');
	const entityProperty = MIGRATION_CONFIG[entityType].entityProperty;
	let snapshotsUpdated = 0;
	const entries = document.entries.map((entry, index) => {
		if (!isRecord(entry) || !isRecord(entry[entityProperty])) {
			throw new TypeError(
				`Invalid ${entityType} history entry ${index}: ${filePath}`,
			);
		}
		const migrated = migrateEntitySnapshot(
			entry[entityProperty],
			entityType,
			entityKey,
		);
		if (migrated.changed) {
			snapshotsUpdated += 1;
		}
		return migrated.changed
			? { ...entry, [entityProperty]: migrated.value }
			: entry;
	});
	return {
		changed: snapshotsUpdated > 0,
		path: filePath,
		snapshotsUpdated,
		value: snapshotsUpdated > 0 ? { ...document, entries } : document,
	};
}

function migrateEntitySnapshot(snapshot, entityType, expectedKey = snapshot?.key) {
	const config = MIGRATION_CONFIG[entityType];
	if (!config) {
		throw new TypeError(`Unsupported entity type: ${entityType}`);
	}
	if (!isRecord(snapshot) || !isRecord(snapshot.statistics)) {
		throw new TypeError(`${entityType} snapshot requires a statistics object.`);
	}
	if (![
		config.previousVersion,
		config.currentVersion,
	].includes(snapshot.schemaVersion)) {
		throw new TypeError(
			`Unsupported ${entityType} schemaVersion ${snapshot.schemaVersion}; `
			+ `expected ${config.previousVersion} or ${config.currentVersion}.`,
		);
	}

	const hasObsoleteStatistics = Object.hasOwn(snapshot.statistics, 'initiative')
		|| Object.hasOwn(snapshot.statistics, 'reflexes');
	const changed = snapshot.schemaVersion !== config.currentVersion
		|| hasObsoleteStatistics;
	const migrated = changed ? structuredClone(snapshot) : snapshot;
	if (changed) {
		migrated.schemaVersion = config.currentVersion;
		delete migrated.statistics.initiative;
		delete migrated.statistics.reflexes;
	}
	config.validate(migrated, expectedKey);
	return { changed, value: migrated };
}

async function listJsonFiles(directory) {
	let entries;
	try {
		entries = await fs.readdir(directory, { withFileTypes: true });
	}
	catch (error) {
		if (error.code === 'ENOENT') {
			return [];
		}
		throw error;
	}
	return entries
		.filter(entry => entry.isFile() && entry.name.endsWith('.json'))
		.map(entry => path.join(directory, entry.name))
		.sort((left, right) => left.localeCompare(right));
}

async function readJson(filePath) {
	try {
		return JSON.parse(await fs.readFile(filePath, 'utf8'));
	}
	catch (error) {
		throw new Error(`Unable to read migration input ${filePath}.`, { cause: error });
	}
}

function isRecord(value) {
	return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

if (require.main === module) {
	const saveRoot = process.argv[2]
		? path.resolve(process.argv[2])
		: DEFAULT_SAVE_ROOT;
	migrateSevenStatisticsSaves(saveRoot)
		.then(result => {
			console.log(
				`Seven-stat migration complete: ${result.filesUpdated}/`
				+ `${result.filesScanned} files updated, `
				+ `${result.snapshotsUpdated} snapshots migrated.`,
			);
		})
		.catch(error => {
			console.error(error);
			process.exitCode = 1;
		});
}

module.exports = {
	DEFAULT_SAVE_ROOT,
	migrateEntitySnapshot,
	migrateSevenStatisticsSaves,
};

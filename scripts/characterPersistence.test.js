const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');

const testSaveDirectory = fs.mkdtempSync(
	path.join(os.tmpdir(), 'incredible-bot-persistence-'),
);
process.env.INCREDIBLE_BOT_SAVE_DIRECTORY = testSaveDirectory;

const { writeJsonAtomically } = require('../services/atomicJsonFile');
const {
	getCharacterOperationQueueSize,
	getPendingCharacterOperationCount,
} = require('../services/characterOperationQueue');
const {
	createCharacter,
	deleteCharacter,
	getCharacter,
	updateCharacter,
} = require('../services/characterStore');

after(() => {
	fs.rmSync(testSaveDirectory, { recursive: true, force: true });
});

test('talent arrays round-trip and legacy multiline saves remain compatible', async () => {
	const arrayKey = 'Talents.Array';
	const talents = [
		'Athlete — +1 to sustained movement.',
		'Cold Immunity — Ordinary cold cannot freeze the character.',
	];
	await createCharacter(arrayKey, 'creator', character => {
		character.talents = [...talents];
	});

	assert.deepEqual((await getCharacter(arrayKey)).talents, talents);
	assert.deepEqual(JSON.parse(await readSave(arrayKey)).talents, talents);

	const legacyKey = 'Talents.Legacy';
	await fsPromises.writeFile(
		getSavePath(legacyKey),
		JSON.stringify({
			schemaVersion: 1,
			key: legacyKey,
			creatorId: 'creator',
			talents: [
				'Athlete — +1 to sustained movement.',
				'Cold Immunity — Ordinary cold cannot freeze the character.',
			].join('\n'),
		}),
		'utf8',
	);
	assert.deepEqual((await getCharacter(legacyKey)).talents, talents);

	await updateCharacter(legacyKey, () => true, character => {
		character.level = 2;
	});
	assert.deepEqual(JSON.parse(await readSave(legacyKey)).talents, talents);
});

test('encumbrance defaults and explicit values round-trip without rewriting on load', async () => {
	const defaultKey = 'Encumbrance.Default';
	await createCharacter(defaultKey, 'creator');
	assert.deepEqual((await getCharacter(defaultKey)).gear.encumbrance, { current: 0, max: 0 });
	assert.deepEqual(
		JSON.parse(await readSave(defaultKey)).gear.encumbrance,
		{ current: 0, max: 0 },
	);

	const legacyKey = 'Encumbrance.Legacy';
	const legacySave = JSON.stringify({
		schemaVersion: 1,
		key: legacyKey,
		creatorId: 'creator',
		encumbrance: { current: 3 },
		stats: { constitution: 18 },
	});
	await fsPromises.writeFile(getSavePath(legacyKey), legacySave, 'utf8');
	assert.deepEqual((await getCharacter(legacyKey)).gear.encumbrance, { current: 3, max: 0 });
	assert.equal(await readSave(legacyKey), legacySave);

	const explicitKey = 'Encumbrance.Explicit';
	await createCharacter(explicitKey, 'creator', character => {
		character.gear.encumbrance = { current: 5, max: 12 };
	});
	await updateCharacter(explicitKey, () => true, character => {
		character.level = 2;
	});
	assert.deepEqual((await getCharacter(explicitKey)).gear.encumbrance, { current: 5, max: 12 });
	assert.deepEqual(
		JSON.parse(await readSave(explicitKey)).gear.encumbrance,
		{ current: 5, max: 12 },
	);
});

test('concurrent updates to one character read the preceding saved result', async () => {
	const characterKey = 'Concurrent.Fields';
	await createCharacter(characterKey, 'creator');
	const firstStarted = createDeferred();
	const releaseFirst = createDeferred();
	const mutationOrder = [];

	const firstUpdate = updateCharacter(characterKey, () => true, async character => {
		mutationOrder.push('first-start');
		character.name.firstName = 'First';
		firstStarted.resolve();
		await releaseFirst.promise;
		mutationOrder.push('first-finish');
	});
	await firstStarted.promise;

	const secondUpdate = updateCharacter(characterKey, () => true, character => {
		mutationOrder.push('second');
		character.name.lastName = 'Second';
	});
	assert.equal(getPendingCharacterOperationCount(characterKey), 2);

	releaseFirst.resolve();
	await Promise.all([firstUpdate, secondUpdate]);

	const savedCharacter = await getCharacter(characterKey);
	assert.equal(savedCharacter.name.firstName, 'First');
	assert.equal(savedCharacter.name.lastName, 'Second');
	assert.deepEqual(mutationOrder, ['first-start', 'first-finish', 'second']);
	assert.equal(getCharacterOperationQueueSize(), 0);
});

test('queued numeric updates do not lose changes', async () => {
	const characterKey = 'Concurrent.Numeric';
	const updateCount = 20;
	await createCharacter(characterKey, 'creator');
	const firstStarted = createDeferred();
	const releaseFirst = createDeferred();
	let mutationCount = 0;

	const updates = Array.from({ length: updateCount }, () => (
		updateCharacter(characterKey, () => true, async character => {
			mutationCount += 1;
			if (mutationCount === 1) {
				firstStarted.resolve();
				await releaseFirst.promise;
			}
			character.level += 1;
		})
	));

	await firstStarted.promise;
	assert.equal(getPendingCharacterOperationCount(characterKey), updateCount);
	releaseFirst.resolve();
	await Promise.all(updates);

	assert.equal((await getCharacter(characterKey)).level, updateCount + 1);
	assert.equal(getCharacterOperationQueueSize(), 0);
});

test('updates to different characters can execute concurrently', { timeout: 2_000 }, async () => {
	const firstKey = 'Concurrent.First';
	const secondKey = 'Concurrent.Second';
	await Promise.all([
		createCharacter(firstKey, 'creator'),
		createCharacter(secondKey, 'creator'),
	]);
	const firstStarted = createDeferred();
	const secondStarted = createDeferred();
	const releaseFirst = createDeferred();
	const releaseSecond = createDeferred();

	const firstUpdate = updateCharacter(firstKey, () => true, async character => {
		character.name.firstName = 'First';
		firstStarted.resolve();
		await releaseFirst.promise;
	});
	await firstStarted.promise;
	const secondUpdate = updateCharacter(secondKey, () => true, async character => {
		character.name.firstName = 'Second';
		secondStarted.resolve();
		await releaseSecond.promise;
	});
	await secondStarted.promise;

	assert.equal(getPendingCharacterOperationCount(firstKey), 1);
	assert.equal(getPendingCharacterOperationCount(secondKey), 1);
	assert.equal(getCharacterOperationQueueSize(), 2);

	releaseFirst.resolve();
	releaseSecond.resolve();
	await Promise.all([firstUpdate, secondUpdate]);
	assert.equal(getCharacterOperationQueueSize(), 0);
});

test('concurrent creation of the same key remains exclusive', async () => {
	const characterKey = 'Concurrent.Creation';
	const firstStarted = createDeferred();
	const releaseFirst = createDeferred();

	const firstCreation = createCharacter(
		characterKey,
		'first-creator',
		async character => {
			character.name.firstName = 'First';
			firstStarted.resolve();
			await releaseFirst.promise;
		},
	);
	await firstStarted.promise;
	const secondCreation = createCharacter(characterKey, 'second-creator');
	assert.equal(getPendingCharacterOperationCount(characterKey), 2);

	releaseFirst.resolve();
	const [firstResult, secondResult] = await Promise.allSettled([
		firstCreation,
		secondCreation,
	]);

	assert.equal(firstResult.status, 'fulfilled');
	assert.equal(secondResult.status, 'rejected');
	assert.equal(secondResult.reason.code, 'EEXIST');
	assert.equal((await getCharacter(characterKey)).creatorId, 'first-creator');
	assert.equal(getCharacterOperationQueueSize(), 0);
});

test('an update and deletion of one character execute sequentially', async () => {
	const characterKey = 'Concurrent.Deletion';
	await createCharacter(characterKey, 'creator');
	const updateStarted = createDeferred();
	const releaseUpdate = createDeferred();

	const update = updateCharacter(characterKey, () => true, async character => {
		character.name.firstName = 'Updated';
		updateStarted.resolve();
		await releaseUpdate.promise;
	});
	await updateStarted.promise;
	const deletion = deleteCharacter(characterKey, () => true);
	assert.equal(getPendingCharacterOperationCount(characterKey), 2);

	releaseUpdate.resolve();
	await Promise.all([update, deletion]);

	await assert.rejects(getCharacter(characterKey), { code: 'ENOENT' });
	assert.equal(getCharacterOperationQueueSize(), 0);
});

test('a throwing mutation does not persist changes or retain its lock', async () => {
	const characterKey = 'Failure.Mutation';
	await createCharacter(characterKey, 'creator');
	const mutationError = new Error('controlled mutation failure');

	await assert.rejects(
		updateCharacter(characterKey, () => true, character => {
			character.name.firstName = 'Not persisted';
			throw mutationError;
		}),
		error => error === mutationError,
	);

	assert.equal((await getCharacter(characterKey)).name.firstName, '');
	assert.equal(getCharacterOperationQueueSize(), 0);

	await updateCharacter(characterKey, () => true, character => {
		character.name.lastName = 'Recovered';
	});
	assert.equal((await getCharacter(characterKey)).name.lastName, 'Recovered');
	assert.equal(getCharacterOperationQueueSize(), 0);
});

test('serialization failure preserves the previous save and cleans the lock', async () => {
	const characterKey = 'Failure.Serialization';
	await createCharacter(characterKey, 'creator', character => {
		character.name.firstName = 'Valid';
	});
	const previousSave = await readSave(characterKey);

	await assert.rejects(
		updateCharacter(characterKey, () => true, character => {
			character.circularReference = character;
		}),
		TypeError,
	);

	assert.equal(await readSave(characterKey), previousSave);
	assert.deepEqual(await listTemporaryFiles(), []);
	assert.equal(getCharacterOperationQueueSize(), 0);
});

test('partial temporary-file write failure preserves the destination and cleans up', async () => {
	const characterKey = 'Failure.Write';
	const destinationPath = getSavePath(characterKey);
	const previousSave = '{"valid":true}\n';
	await fsPromises.writeFile(destinationPath, previousSave, 'utf8');
	const writeError = new Error('controlled write failure');
	writeError.code = 'CONTROLLED_WRITE_FAILURE';

	const failingFileSystem = {
		link: fsPromises.link,
		mkdir: fsPromises.mkdir,
		open: async (...arguments_) => {
			const handle = await fsPromises.open(...arguments_);
			return {
				close: () => handle.close(),
				writeFile: async data => {
					await handle.writeFile(data.slice(0, 10), 'utf8');
					throw writeError;
				},
			};
		},
		rename: fsPromises.rename,
		unlink: fsPromises.unlink,
	};

	await assert.rejects(
		writeJsonAtomically(
			destinationPath,
			{ valid: false, replacement: 'must not appear' },
			{ fileSystem: failingFileSystem, uniqueId: () => 'controlled' },
		),
		error => error === writeError,
	);

	assert.equal(await fsPromises.readFile(destinationPath, 'utf8'), previousSave);
	assert.deepEqual(await listTemporaryFiles(), []);
});

function createDeferred() {
	let resolve;
	const promise = new Promise(resolvePromise => {
		resolve = resolvePromise;
	});
	return { promise, resolve };
}

function getSavePath(characterKey) {
	return path.join(testSaveDirectory, `${characterKey}.json`);
}

async function readSave(characterKey) {
	return fsPromises.readFile(getSavePath(characterKey), 'utf8');
}

async function listTemporaryFiles() {
	return (await fsPromises.readdir(testSaveDirectory))
		.filter(fileName => fileName.endsWith('.tmp'));
}

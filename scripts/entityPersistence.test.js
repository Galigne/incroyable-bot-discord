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
	getEntityOperationQueueSize,
	getPendingEntityOperationCount,
} = require('../services/entityOperationQueue');
const {
	createCharacter,
	deleteCharacter,
	getCharacter,
	updateCharacter,
} = require('../services/characterStore');
const {
	characterSaveDirectory,
	getCharacterSavePath,
} = require('../services/entityStoragePaths');

after(() => {
	fs.rmSync(testSaveDirectory, { recursive: true, force: true });
});

test('talent arrays round-trip in the current save schema', async () => {
	const arrayKey = 'Talents.Array';
	const talents = [
		'Athlete — +1 to sustained movement.',
		'Cold Immunity — Ordinary cold cannot freeze the character.',
	];
	await createCharacter(arrayKey, ownerAccess('creator'), character => {
		character.talents = [...talents];
	});

	assert.deepEqual((await getCharacter(arrayKey)).talents, talents);
	assert.deepEqual(JSON.parse(await readSave(arrayKey)).talents, talents);

	const malformedKey = 'Talents.Malformed';
	const malformedSave = JSON.parse(await readSave(arrayKey));
	malformedSave.key = malformedKey;
	malformedSave.talents = talents.join('\n');
	const malformedSerialized = JSON.stringify(malformedSave);
	await fsPromises.writeFile(getSavePath(malformedKey), malformedSerialized, 'utf8');
	await assert.rejects(
		getCharacter(malformedKey),
		{ code: 'INVALID_CHARACTER_SAVE' },
	);
	assert.equal(await readSave(malformedKey), malformedSerialized);
});

test('encumbrance defaults and explicit values round-trip in complete saves', async () => {
	const defaultKey = 'Encumbrance.Default';
	await createCharacter(defaultKey, ownerAccess('creator'));
	assert.deepEqual((await getCharacter(defaultKey)).gear.encumbrance, { current: 0, max: 0 });
	assert.deepEqual(
		JSON.parse(await readSave(defaultKey)).gear.encumbrance,
		{ current: 0, max: 0 },
	);

	const malformedKey = 'Encumbrance.Malformed';
	const malformedSave = JSON.parse(await readSave(defaultKey));
	malformedSave.key = malformedKey;
	delete malformedSave.gear.encumbrance.max;
	const malformedSerialized = JSON.stringify(malformedSave);
	await fsPromises.writeFile(getSavePath(malformedKey), malformedSerialized, 'utf8');
	await assert.rejects(
		getCharacter(malformedKey),
		{ code: 'INVALID_CHARACTER_SAVE' },
	);
	assert.equal(await readSave(malformedKey), malformedSerialized);

	const explicitKey = 'Encumbrance.Explicit';
	await createCharacter(explicitKey, ownerAccess('creator'), character => {
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

test('concurrent updates to one entity read the preceding saved result', async () => {
	const characterKey = 'Concurrent.Fields';
	await createCharacter(characterKey, ownerAccess('creator'));
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
	assert.equal(getPendingEntityOperationCount(characterKey), 2);

	releaseFirst.resolve();
	await Promise.all([firstUpdate, secondUpdate]);

	const savedCharacter = await getCharacter(characterKey);
	assert.equal(savedCharacter.name.firstName, 'First');
	assert.equal(savedCharacter.name.lastName, 'Second');
	assert.deepEqual(mutationOrder, ['first-start', 'first-finish', 'second']);
	assert.equal(getEntityOperationQueueSize(), 0);
});

test('queued numeric updates do not lose changes', async () => {
	const characterKey = 'Concurrent.Numeric';
	const updateCount = 20;
	await createCharacter(characterKey, ownerAccess('creator'));
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
			character.gear.encumbrance.max += 1;
		})
	));

	await firstStarted.promise;
	assert.equal(getPendingEntityOperationCount(characterKey), updateCount);
	releaseFirst.resolve();
	await Promise.all(updates);

	assert.equal((await getCharacter(characterKey)).gear.encumbrance.max, updateCount);
	assert.equal(getEntityOperationQueueSize(), 0);
});

test('updates to different entities can execute concurrently', { timeout: 2_000 }, async () => {
	const firstKey = 'Concurrent.First';
	const secondKey = 'Concurrent.Second';
	await Promise.all([
		createCharacter(firstKey, ownerAccess('creator')),
		createCharacter(secondKey, ownerAccess('creator')),
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

	assert.equal(getPendingEntityOperationCount(firstKey), 1);
	assert.equal(getPendingEntityOperationCount(secondKey), 1);
	assert.equal(getEntityOperationQueueSize(), 2);

	releaseFirst.resolve();
	releaseSecond.resolve();
	await Promise.all([firstUpdate, secondUpdate]);
	assert.equal(getEntityOperationQueueSize(), 0);
});

test('concurrent creation of the same key remains exclusive', async () => {
	const characterKey = 'Concurrent.Creation';
	const firstStarted = createDeferred();
	const releaseFirst = createDeferred();

	const firstCreation = createCharacter(
		characterKey,
		ownerAccess('first-creator'),
		async character => {
			character.name.firstName = 'First';
			firstStarted.resolve();
			await releaseFirst.promise;
		},
	);
	await firstStarted.promise;
	const secondCreation = createCharacter(characterKey, ownerAccess('second-creator'));
	assert.equal(getPendingEntityOperationCount(characterKey), 2);

	releaseFirst.resolve();
	const [firstResult, secondResult] = await Promise.allSettled([
		firstCreation,
		secondCreation,
	]);

	assert.equal(firstResult.status, 'fulfilled');
	assert.equal(secondResult.status, 'rejected');
	assert.equal(secondResult.reason.code, 'EEXIST');
	assert.deepEqual((await getCharacter(characterKey)).access, ownerAccess('first-creator'));
	assert.equal(getEntityOperationQueueSize(), 0);
});

test('an update and deletion of one entity execute sequentially', async () => {
	const characterKey = 'Concurrent.Deletion';
	await createCharacter(characterKey, ownerAccess('creator'));
	const updateStarted = createDeferred();
	const releaseUpdate = createDeferred();

	const update = updateCharacter(characterKey, () => true, async character => {
		character.name.firstName = 'Updated';
		updateStarted.resolve();
		await releaseUpdate.promise;
	});
	await updateStarted.promise;
	const deletion = deleteCharacter(characterKey, () => true);
	assert.equal(getPendingEntityOperationCount(characterKey), 2);

	releaseUpdate.resolve();
	await Promise.all([update, deletion]);

	await assert.rejects(getCharacter(characterKey), { code: 'ENOENT' });
	assert.equal(getEntityOperationQueueSize(), 0);
});

test('a throwing mutation does not persist changes or retain its lock', async () => {
	const characterKey = 'Failure.Mutation';
	await createCharacter(characterKey, ownerAccess('creator'));
	const mutationError = new Error('controlled mutation failure');

	await assert.rejects(
		updateCharacter(characterKey, () => true, character => {
			character.name.firstName = 'Not persisted';
			throw mutationError;
		}),
		error => error === mutationError,
	);

	assert.equal((await getCharacter(characterKey)).name.firstName, '');
	assert.equal(getEntityOperationQueueSize(), 0);

	await updateCharacter(characterKey, () => true, character => {
		character.name.lastName = 'Recovered';
	});
	assert.equal((await getCharacter(characterKey)).name.lastName, 'Recovered');
	assert.equal(getEntityOperationQueueSize(), 0);
});

test('invalid persisted shape preserves the previous save and cleans the lock', async () => {
	const characterKey = 'Failure.Serialization';
	await createCharacter(characterKey, ownerAccess('creator'), character => {
		character.name.firstName = 'Valid';
	});
	const previousSave = await readSave(characterKey);

	await assert.rejects(
		updateCharacter(characterKey, () => true, character => {
			character.circularReference = character;
		}),
		{ code: 'INVALID_CHARACTER_SAVE' },
	);

	assert.equal(await readSave(characterKey), previousSave);
	assert.deepEqual(await listTemporaryFiles(), []);
	assert.equal(getEntityOperationQueueSize(), 0);
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
	return getCharacterSavePath(characterKey);
}

async function readSave(characterKey) {
	return fsPromises.readFile(getSavePath(characterKey), 'utf8');
}

async function listTemporaryFiles() {
	return (await fsPromises.readdir(characterSaveDirectory))
		.filter(fileName => fileName.endsWith('.tmp'));
}

function ownerAccess(userId) {
	return [{ userId, level: 'owner' }];
}

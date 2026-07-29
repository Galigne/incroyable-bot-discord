const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

async function writeJsonAtomically(
	destinationPath,
	data,
	{
		exclusive = false,
		fileSystem = fs,
		uniqueId = randomUUID,
	} = {},
) {
	const serializedData = JSON.stringify(data, null, 2);
	if (serializedData === undefined) {
		throw new TypeError('Data could not be serialized to JSON.');
	}

	const destinationDirectory = path.dirname(destinationPath);
	const temporaryPath = path.join(
		destinationDirectory,
		`.${path.basename(destinationPath)}.${process.pid}.${uniqueId()}.tmp`,
	);
	let temporaryFileCreated = false;

	try {
		await fileSystem.mkdir(destinationDirectory, { recursive: true });
		const temporaryFile = await fileSystem.open(temporaryPath, 'wx');
		temporaryFileCreated = true;
		try {
			await temporaryFile.writeFile(serializedData, 'utf8');
		}
		finally {
			await temporaryFile.close();
		}

		if (exclusive) {
			await fileSystem.link(temporaryPath, destinationPath);
			await fileSystem.unlink(temporaryPath);
		}
		else {
			await fileSystem.rename(temporaryPath, destinationPath);
		}
		temporaryFileCreated = false;
	}
	catch (error) {
		if (temporaryFileCreated) {
			await removeTemporaryFile(fileSystem, temporaryPath, error);
		}
		throw error;
	}
}

async function removeTemporaryFile(fileSystem, temporaryPath, originalError) {
	try {
		await fileSystem.unlink(temporaryPath);
	}
	catch (cleanupError) {
		if (cleanupError.code !== 'ENOENT') {
			Object.defineProperty(originalError, 'cleanupError', {
				configurable: true,
				value: cleanupError,
			});
		}
	}
}

module.exports = {
	writeJsonAtomically,
};

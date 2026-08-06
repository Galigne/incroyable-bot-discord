const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function createTemporaryEntityStorage() {
	return fs.mkdtempSync(path.join(os.tmpdir(), 'incredible-bot-check-'));
}

function removeTemporaryEntityStorage(directory) {
	const resolvedDirectory = path.resolve(directory);
	const resolvedSystemTemporaryDirectory = path.resolve(os.tmpdir());
	if (
		resolvedDirectory.startsWith(`${resolvedSystemTemporaryDirectory}${path.sep}`)
		&& path.basename(resolvedDirectory).startsWith('incredible-bot-check-')
	) {
		fs.rmSync(resolvedDirectory, { recursive: true, force: true });
	}
}

module.exports = {
	createTemporaryEntityStorage,
	removeTemporaryEntityStorage,
};

const characterOperationQueues = new Map();

async function runCharacterOperation(characterKey, operation) {
	let queue = characterOperationQueues.get(characterKey);
	if (!queue) {
		queue = {
			pending: 0,
			tail: Promise.resolve(),
		};
		characterOperationQueues.set(characterKey, queue);
	}

	const previousOperation = queue.tail;
	let release;
	queue.tail = new Promise(resolve => {
		release = resolve;
	});
	queue.pending += 1;

	await previousOperation;
	try {
		return await operation();
	}
	finally {
		queue.pending -= 1;
		release();
		if (
			queue.pending === 0
			&& characterOperationQueues.get(characterKey) === queue
		) {
			characterOperationQueues.delete(characterKey);
		}
	}
}

function getCharacterOperationQueueSize() {
	return characterOperationQueues.size;
}

function getPendingCharacterOperationCount(characterKey) {
	return characterOperationQueues.get(characterKey)?.pending ?? 0;
}

module.exports = {
	getCharacterOperationQueueSize,
	getPendingCharacterOperationCount,
	runCharacterOperation,
};

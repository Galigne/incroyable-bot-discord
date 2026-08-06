const entityOperationQueues = new Map();

async function runEntityOperation(entityKey, operation) {
	let queue = entityOperationQueues.get(entityKey);
	if (!queue) {
		queue = {
			pending: 0,
			tail: Promise.resolve(),
		};
		entityOperationQueues.set(entityKey, queue);
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
			&& entityOperationQueues.get(entityKey) === queue
		) {
			entityOperationQueues.delete(entityKey);
		}
	}
}

const runCharacterOperation = runEntityOperation;

function getCharacterOperationQueueSize() {
	return entityOperationQueues.size;
}

function getPendingCharacterOperationCount(characterKey) {
	return entityOperationQueues.get(characterKey)?.pending ?? 0;
}

const getEntityOperationQueueSize = getCharacterOperationQueueSize;
const getPendingEntityOperationCount = getPendingCharacterOperationCount;

module.exports = {
	getCharacterOperationQueueSize,
	getEntityOperationQueueSize,
	getPendingCharacterOperationCount,
	getPendingEntityOperationCount,
	runCharacterOperation,
	runEntityOperation,
};

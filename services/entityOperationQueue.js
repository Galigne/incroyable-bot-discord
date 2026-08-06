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

function getEntityOperationQueueSize() {
	return entityOperationQueues.size;
}

function getPendingEntityOperationCount(entityKey) {
	return entityOperationQueues.get(entityKey)?.pending ?? 0;
}

module.exports = {
	getEntityOperationQueueSize,
	getPendingEntityOperationCount,
	runEntityOperation,
};

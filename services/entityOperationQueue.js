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

async function runEntityOperations(entityKeys, operation) {
	const orderedKeys = [...new Set(entityKeys)].sort((left, right) => (
		left.localeCompare(right)
	));
	async function acquire(index) {
		if (index === orderedKeys.length) {
			return operation();
		}
		return runEntityOperation(orderedKeys[index], () => acquire(index + 1));
	}
	return acquire(0);
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
	runEntityOperations,
};

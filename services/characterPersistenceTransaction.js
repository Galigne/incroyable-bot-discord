function createPersistenceError(cause, entityType = 'character') {
	const label = getEntityLabel(entityType);
	const error = new Error(`The ${label} and history operation could not be persisted.`, {
		cause,
	});
	error.name = `${capitalize(label)}HistoryPersistenceError`;
	error.code = `${label.toUpperCase()}_HISTORY_PERSISTENCE_FAILED`;
	return error;
}

function createConsistencyError(cause, rollbackError, entityType = 'character') {
	const label = getEntityLabel(entityType);
	const error = new Error(`The ${label} and history operation could not be rolled back.`, {
		cause,
	});
	error.name = `${capitalize(label)}HistoryConsistencyError`;
	error.code = `${label.toUpperCase()}_HISTORY_CONSISTENCY_FAILED`;
	Object.defineProperty(error, 'rollbackError', {
		configurable: true,
		value: rollbackError,
	});
	return error;
}

function createDeletionPersistenceError(cause, entityType = 'character') {
	const label = getEntityLabel(entityType);
	const error = new Error(
		`The ${label} and its history could not be permanently deleted.`,
		{ cause },
	);
	error.name = `${capitalize(label)}DeletionPersistenceError`;
	error.code = `${label.toUpperCase()}_DELETION_PERSISTENCE_FAILED`;
	return error;
}

function createDeletionConsistencyError(
	cause,
	rollbackError,
	entityType = 'character',
) {
	const label = getEntityLabel(entityType);
	const error = new Error(
		`The permanent ${label} deletion could not be rolled back.`,
		{ cause },
	);
	error.name = `${capitalize(label)}DeletionConsistencyError`;
	error.code = `${label.toUpperCase()}_DELETION_CONSISTENCY_FAILED`;
	Object.defineProperty(error, 'rollbackError', {
		configurable: true,
		value: rollbackError,
	});
	return error;
}

async function commitHistoryThenMutation({
	characterKey,
	commitMutation,
	entityKey = characterKey,
	entityType = 'character',
	logger = console,
	rollbackHistory,
	writeHistory,
}) {
	try {
		await writeHistory();
	}
	catch (error) {
		throw createPersistenceError(error, entityType);
	}

	try {
		await commitMutation();
	}
	catch (error) {
		await rollbackOrThrow({
			cause: error,
			entityKey,
			entityType,
			logger,
			rollback: rollbackHistory,
		});
		throw createPersistenceError(error, entityType);
	}
}

async function commitMutationThenHistory({
	characterKey,
	commitMutation,
	entityKey = characterKey,
	entityType = 'character',
	logger = console,
	rollbackMutation,
	writeHistory,
}) {
	try {
		await commitMutation();
	}
	catch (error) {
		throw createPersistenceError(error, entityType);
	}

	try {
		await writeHistory();
	}
	catch (error) {
		await rollbackOrThrow({
			cause: error,
			entityKey,
			entityType,
			logger,
			rollback: rollbackMutation,
		});
		throw createPersistenceError(error, entityType);
	}
}

async function commitPermanentDeletion({
	characterKey,
	deleteCharacter,
	deleteEntity = deleteCharacter,
	deleteHistory,
	entityKey = characterKey,
	entityType = 'character',
	logger = console,
	restoreHistory,
}) {
	try {
		await deleteHistory();
	}
	catch (error) {
		throw createDeletionPersistenceError(error, entityType);
	}

	try {
		await deleteEntity();
	}
	catch (error) {
		try {
			await restoreHistory();
		}
		catch (rollbackError) {
			logger.error(
				`[${entityType}-deletion] Unrecoverable rollback failure for "${entityKey}":`,
				rollbackError,
			);
			throw createDeletionConsistencyError(error, rollbackError, entityType);
		}
		throw createDeletionPersistenceError(error, entityType);
	}
}

async function rollbackOrThrow({
	cause,
	entityKey,
	entityType,
	logger,
	rollback,
}) {
	try {
		await rollback();
	}
	catch (rollbackError) {
		logger.error(
			`[${entityType}-history] Unrecoverable rollback failure for "${entityKey}":`,
			rollbackError,
		);
		throw createConsistencyError(cause, rollbackError, entityType);
	}
}

function getEntityLabel(entityType) {
	return entityType === 'creature' ? 'creature' : 'character';
}

function capitalize(value) {
	return value[0].toUpperCase() + value.slice(1);
}

module.exports = {
	commitHistoryThenMutation,
	commitMutationThenHistory,
	commitPermanentDeletion,
};

function createPersistenceError(cause) {
	const error = new Error('The character and history operation could not be persisted.', {
		cause,
	});
	error.name = 'CharacterHistoryPersistenceError';
	error.code = 'CHARACTER_HISTORY_PERSISTENCE_FAILED';
	return error;
}

function createConsistencyError(cause, rollbackError) {
	const error = new Error('The character and history operation could not be rolled back.', {
		cause,
	});
	error.name = 'CharacterHistoryConsistencyError';
	error.code = 'CHARACTER_HISTORY_CONSISTENCY_FAILED';
	Object.defineProperty(error, 'rollbackError', {
		configurable: true,
		value: rollbackError,
	});
	return error;
}

function createDeletionPersistenceError(cause) {
	const error = new Error(
		'The character and its history could not be permanently deleted.',
		{ cause },
	);
	error.name = 'CharacterDeletionPersistenceError';
	error.code = 'CHARACTER_DELETION_PERSISTENCE_FAILED';
	return error;
}

function createDeletionConsistencyError(cause, rollbackError) {
	const error = new Error(
		'The permanent character deletion could not be rolled back.',
		{ cause },
	);
	error.name = 'CharacterDeletionConsistencyError';
	error.code = 'CHARACTER_DELETION_CONSISTENCY_FAILED';
	Object.defineProperty(error, 'rollbackError', {
		configurable: true,
		value: rollbackError,
	});
	return error;
}

async function commitHistoryThenMutation({
	characterKey,
	commitMutation,
	logger = console,
	rollbackHistory,
	writeHistory,
}) {
	try {
		await writeHistory();
	}
	catch (error) {
		throw createPersistenceError(error);
	}

	try {
		await commitMutation();
	}
	catch (error) {
		await rollbackOrThrow({
			characterKey,
			cause: error,
			logger,
			rollback: rollbackHistory,
		});
		throw createPersistenceError(error);
	}
}

async function commitMutationThenHistory({
	characterKey,
	commitMutation,
	logger = console,
	rollbackMutation,
	writeHistory,
}) {
	try {
		await commitMutation();
	}
	catch (error) {
		throw createPersistenceError(error);
	}

	try {
		await writeHistory();
	}
	catch (error) {
		await rollbackOrThrow({
			characterKey,
			cause: error,
			logger,
			rollback: rollbackMutation,
		});
		throw createPersistenceError(error);
	}
}

async function commitPermanentDeletion({
	characterKey,
	deleteCharacter,
	deleteHistory,
	logger = console,
	restoreHistory,
}) {
	try {
		await deleteHistory();
	}
	catch (error) {
		throw createDeletionPersistenceError(error);
	}

	try {
		await deleteCharacter();
	}
	catch (error) {
		try {
			await restoreHistory();
		}
		catch (rollbackError) {
			logger.error(
				`[character-deletion] Unrecoverable rollback failure for "${characterKey}":`,
				rollbackError,
			);
			throw createDeletionConsistencyError(error, rollbackError);
		}
		throw createDeletionPersistenceError(error);
	}
}

async function rollbackOrThrow({
	characterKey,
	cause,
	logger,
	rollback,
}) {
	try {
		await rollback();
	}
	catch (rollbackError) {
		logger.error(
			`[character-history] Unrecoverable rollback failure for "${characterKey}":`,
			rollbackError,
		);
		throw createConsistencyError(cause, rollbackError);
	}
}

module.exports = {
	commitHistoryThenMutation,
	commitMutationThenHistory,
	commitPermanentDeletion,
};

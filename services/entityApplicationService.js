const entityStore = require('./entityStore');
const {
	createOwnedPublicSettings,
	parseEntitySettingsSubmission,
	serializeEntitySettings,
} = require('./entitySettings');
const { assertEntityType } = require('./entityType');
const {
	getEditableEntityFieldValue,
	setEditableEntityFieldValue,
} = require('./entityEditor');
const { dealDamage } = require('./mechanics/damage');
const {
	resetTurnResources,
	restoreHealingResources,
} = require('./mechanics/resources');

async function createEntity(entityKey, userId, type = 'character') {
	return entityStore.createEntity(entityKey, type, createOwnedPublicSettings(userId));
}

async function deleteEntity(entityKey, canManage, expectedType = null) {
	return entityStore.deleteEntity(entityKey, entity => {
		assertExpectedType(entity, expectedType);
		return canManage(entity);
	});
}

async function getEntity(entityKey) {
	return entityStore.getEntity(entityKey);
}

async function getVisibleEntity(entityKey, canView) {
	const entity = await entityStore.getEntity(entityKey);
	if (!canView(entity)) {
		const error = new Error(`Entity "${entityKey}" does not exist.`);
		error.code = 'ENOENT';
		throw error;
	}
	return entity;
}

async function listEntities(options) {
	return entityStore.listEntities(options);
}

async function listUndoableEntities(canManage, options) {
	return entityStore.listUndoableEntities(canManage, options);
}

async function damageEntity(
	entityKey,
	damageAmount,
	piercing,
	canManage,
	operationContext,
) {
	let damage;
	const entity = await entityStore.updateEntity(
		entityKey,
		canManage,
		currentEntity => {
			damage = dealDamage(currentEntity, damageAmount, piercing);
		},
		createHistoryContext('damage', operationContext),
	);
	return { entity, damage, damageAmount };
}

async function healEntity(
	entityKey,
	resource,
	percentage,
	canManage,
	operationContext,
) {
	let changes;
	const entity = await entityStore.updateEntity(
		entityKey,
		canManage,
		currentEntity => {
			changes = restoreHealingResources(currentEntity, resource, percentage);
		},
		createHistoryContext('heal', operationContext),
	);
	return { entity, changes, percentage };
}

async function endEntityTurn(entityKey, canManage, operationContext) {
	const entity = await entityStore.updateEntity(
		entityKey,
		canManage,
		resetTurnResources,
		createHistoryContext('end-turn', operationContext),
	);
	return { entity };
}

async function getEditableEntity(entityKey, canManage) {
	const entity = await entityStore.getEntity(entityKey);
	if (!canManage(entity)) {
		throw entityAuthorizationError('EDITOR');
	}
	return entity;
}

async function getDeletableEntity(entityKey, canManage) {
	const entity = await entityStore.getEntity(entityKey);
	if (!canManage(entity)) {
		throw entityAuthorizationError('OWNER');
	}
	return entity;
}

async function getEditableEntityField(
	entityKey,
	fieldName,
	canManage,
	hasFullAuthority = canManage,
) {
	const normalizedFieldName = typeof fieldName === 'string'
		? fieldName.toLowerCase()
		: fieldName;
	const entity = normalizedFieldName === 'settings'
		? await getDeletableEntity(entityKey, hasFullAuthority)
		: await getEditableEntity(entityKey, canManage);
	return {
		entity,
		value: normalizedFieldName === 'settings'
			? serializeEntitySettings(entity)
			: getEditableEntityFieldValue(entity, normalizedFieldName),
	};
}

async function updateEntitySettings(
	entityKey,
	submittedValue,
	hasFullAuthority,
	expectedType = null,
) {
	const parsed = parseEntitySettingsSubmission(submittedValue);
	const entity = await entityStore.updateEntitySettings(
		entityKey,
		parsed.key,
		parsed.settings,
		currentEntity => {
			if (!hasFullAuthority(currentEntity)) {
				throw entityAuthorizationError('OWNER');
			}
			return true;
		},
		currentEntity => assertExpectedType(currentEntity, expectedType),
	);
	return { entity, previousKey: entityKey };
}

async function updateEditableEntity(
	entityKey,
	fieldName,
	value,
	canManage,
	operationContext,
	expectedType = null,
) {
	let editOutcome;
	const entity = await entityStore.updateEntity(
		entityKey,
		canManage,
		currentEntity => {
			assertExpectedType(currentEntity, expectedType);
			editOutcome = setEditableEntityFieldValue(
				currentEntity,
				fieldName,
				value,
			);
		},
		createHistoryContext('set', operationContext),
	);
	return { editOutcome, entity };
}

function assertExpectedType(entity, expectedType) {
	if (expectedType !== null) {
		assertEntityType(expectedType);
	}
	if (expectedType !== null && entity.type !== expectedType) {
		const error = new Error('The entity type changed while the interaction was open.');
		error.code = 'ENTITY_TYPE_CHANGED';
		throw error;
	}
}

async function undoEntity(entityKey, canManage, operationContext) {
	return entityStore.undoEntity(entityKey, canManage, {
		maxEntries: operationContext.maxEntries,
	});
}

function createHistoryContext(action, operationContext) {
	return operationContext ? { ...operationContext, action } : null;
}

function entityAuthorizationError(kind) {
	const error = new Error(`NOT_ENTITY_${kind}`);
	error.code = `NOT_ENTITY_${kind}`;
	return error;
}

module.exports = {
	createEntity,
	damageEntity,
	deleteEntity,
	endEntityTurn,
	getDeletableEntity,
	getEditableEntity,
	getEditableEntityField,
	getEntity,
	getVisibleEntity,
	healEntity,
	listEntities,
	listUndoableEntities,
	undoEntity,
	updateEditableEntity,
	updateEntitySettings,
};

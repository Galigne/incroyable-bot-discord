const entityStore = require('./entityStore');
const {
	getEditableEntityFieldValue,
	setEditableEntityFieldValue,
} = require('./entityEditor');
const { dealDamage } = require('./mechanics/damage');
const {
	resetTurnResources,
	restoreHealingResources,
} = require('./mechanics/resources');

async function createEntity(entityKey, type = 'character', creatorId) {
	return entityStore.createEntity(entityKey, type, creatorId);
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

async function getEditableEntityField(entityKey, fieldName, canManage) {
	const entity = await getEditableEntity(entityKey, canManage);
	return {
		entity,
		value: getEditableEntityFieldValue(entity, fieldName),
	};
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
	if (expectedType && entity.type !== expectedType) {
		const error = new Error('The entity type changed while the interaction was open.');
		error.code = 'ENTITY_TYPE_CHANGED';
		throw error;
	}
}

async function undoEntity(entityKey, canManage, operationContext) {
	const result = await entityStore.undoEntity(entityKey, canManage, {
		maxEntries: operationContext.maxEntries,
	});
	return {
		...result,
		entity: result.creature ?? result.character,
	};
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
	healEntity,
	listEntities,
	listUndoableEntities,
	undoEntity,
	updateEditableEntity,
};

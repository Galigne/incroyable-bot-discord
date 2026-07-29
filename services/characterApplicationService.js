const characterStore = require('./characterStore');
const {
	getEditableFieldValue,
	setEditableFieldValue,
} = require('./characterEditor');
const { dealDamage } = require('./mechanics/damage');
const {
	resetTurnResources,
	restoreHealingResources,
} = require('./mechanics/resources');
const { populateRandomCharacter } = require('./randomCharacterGenerator');

async function createCharacter(characterKey, creatorId) {
	return characterStore.createCharacter(characterKey, creatorId);
}

async function deleteCharacter(characterKey, canManage, operationContext) {
	return characterStore.deleteCharacter(
		characterKey,
		canManage,
		createHistoryContext('delete', operationContext),
	);
}

async function getCharacter(characterKey) {
	return characterStore.getCharacter(characterKey);
}

async function listCharacters(options) {
	return characterStore.listCharacters(options);
}

async function listUndoableCharacters(canManage, options) {
	return characterStore.listUndoableCharacters(canManage, options);
}

async function damageCharacter(
	characterKey,
	damageAmount,
	piercing,
	canManage,
	operationContext,
) {
	let damage;
	const character = await characterStore.updateCharacter(
		characterKey,
		canManage,
		currentCharacter => {
			damage = dealDamage(currentCharacter, damageAmount, piercing);
		},
		createHistoryContext('damage', operationContext),
	);
	return { character, damage, damageAmount };
}

async function healCharacter(
	characterKey,
	resource,
	percentage,
	canManage,
	operationContext,
) {
	let changes;
	const character = await characterStore.updateCharacter(
		characterKey,
		canManage,
		currentCharacter => {
			changes = restoreHealingResources(currentCharacter, resource, percentage);
		},
		createHistoryContext('heal', operationContext),
	);
	return { character, changes, percentage };
}

async function endCharacterTurn(characterKey, canManage, operationContext) {
	const character = await characterStore.updateCharacter(
		characterKey,
		canManage,
		resetTurnResources,
		createHistoryContext('end-turn', operationContext),
	);
	return { character };
}

async function generateCharacter(characterKey, creatorId, options) {
	return characterStore.createCharacter(
		characterKey,
		creatorId,
		character => populateRandomCharacter(character, options),
	);
}

async function getEditableCharacter(characterKey, canManage) {
	const character = await characterStore.getCharacter(characterKey);
	if (!canManage(character)) {
		throw characterAuthorizationError();
	}
	return character;
}

async function getEditableCharacterField(characterKey, fieldName, canManage) {
	const character = await getEditableCharacter(characterKey, canManage);
	return {
		character,
		value: getEditableFieldValue(character, fieldName),
	};
}

async function updateEditableCharacter(
	characterKey,
	fieldName,
	value,
	canManage,
	operationContext,
) {
	let editOutcome;
	const character = await characterStore.updateCharacter(
		characterKey,
		canManage,
		currentCharacter => {
			editOutcome = setEditableFieldValue(currentCharacter, fieldName, value);
		},
		createHistoryContext('set', operationContext),
	);
	return { character, editOutcome };
}

async function undoCharacter(characterKey, canManage, operationContext) {
	return characterStore.undoCharacter(characterKey, canManage, {
		maxEntries: operationContext.maxEntries,
	});
}

function createHistoryContext(action, operationContext) {
	return operationContext
		? { ...operationContext, action }
		: null;
}

function characterAuthorizationError() {
	const error = new Error('NOT_CHARACTER_EDITOR');
	error.code = 'NOT_CHARACTER_EDITOR';
	return error;
}

module.exports = {
	createCharacter,
	damageCharacter,
	deleteCharacter,
	endCharacterTurn,
	generateCharacter,
	getCharacter,
	getEditableCharacter,
	getEditableCharacterField,
	healCharacter,
	listCharacters,
	listUndoableCharacters,
	undoCharacter,
	updateEditableCharacter,
};

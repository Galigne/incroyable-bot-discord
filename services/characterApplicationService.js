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

async function deleteCharacter(characterKey, canManage) {
	return characterStore.deleteCharacter(characterKey, canManage);
}

async function getCharacter(characterKey) {
	return characterStore.getCharacter(characterKey);
}

async function listCharacters(options) {
	return characterStore.listCharacters(options);
}

async function damageCharacter(characterKey, damageAmount, piercing, canManage) {
	let damage;
	const character = await characterStore.updateCharacter(
		characterKey,
		canManage,
		currentCharacter => {
			damage = dealDamage(currentCharacter, damageAmount, piercing);
		},
	);
	return { character, damage, damageAmount };
}

async function healCharacter(characterKey, resource, percentage, canManage) {
	let changes;
	const character = await characterStore.updateCharacter(
		characterKey,
		canManage,
		currentCharacter => {
			changes = restoreHealingResources(currentCharacter, resource, percentage);
		},
	);
	return { character, changes, percentage };
}

async function endCharacterTurn(characterKey, canManage) {
	const character = await characterStore.updateCharacter(
		characterKey,
		canManage,
		resetTurnResources,
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
) {
	let editOutcome;
	const character = await characterStore.updateCharacter(
		characterKey,
		canManage,
		currentCharacter => {
			editOutcome = setEditableFieldValue(currentCharacter, fieldName, value);
		},
	);
	return { character, editOutcome };
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
	updateEditableCharacter,
};

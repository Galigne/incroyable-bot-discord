const { MessageFlags } = require('discord.js');
const { MAX_AP } = require('../services/mechanics/constants');
const { assertEntityType } = require('../services/entityType');
const { getResourceAbbreviation } = require('./combatantDisplay');
const { getEntityFieldLabel } = require('./entityDisplay');
const { t } = require('./i18n');

const replyableErrorCodes = new Set([
	'EEXIST',
	'ENOENT',
	'ENTITY_KEY_COLLISION',
	'ENTITY_TYPE_CHANGED',
	'INVALID_ENTITY_KEY',
	'INVALID_ENTITY_TYPE',
	'INVALID_RANDOM_CREATURE',
	'INVALID_CHARACTER_EDIT',
	'INVALID_CREATURE_EDIT',
	'INVALID_CHARACTER_HISTORY',
	'INVALID_CHARACTER_HISTORY_SNAPSHOT',
	'INVALID_CREATURE_HISTORY',
	'INVALID_CREATURE_HISTORY_SNAPSHOT',
	'NO_CHARACTER_HISTORY',
	'NO_CREATURE_HISTORY',
	'NOT_CHARACTER_EDITOR',
	'NOT_CHARACTER_OWNER',
	'NOT_CREATURE_EDITOR',
	'NOT_CREATURE_OWNER',
	'NOT_ENTITY_EDITOR',
	'NOT_ENTITY_OWNER',
	'UNSUPPORTED_CHARACTER_HISTORY_SCHEMA',
	'UNSUPPORTED_CREATURE_HISTORY_SCHEMA',
	'CHARACTER_HISTORY_CONSISTENCY_FAILED',
	'CHARACTER_HISTORY_PERSISTENCE_FAILED',
	'CREATURE_HISTORY_CONSISTENCY_FAILED',
	'CREATURE_HISTORY_PERSISTENCE_FAILED',
	'CHARACTER_DELETION_CONSISTENCY_FAILED',
	'CHARACTER_DELETION_PERSISTENCE_FAILED',
	'CREATURE_DELETION_CONSISTENCY_FAILED',
	'CREATURE_DELETION_PERSISTENCE_FAILED',
]);

async function replyToEntityError(interaction, error, locale = 'en') {
	if (!replyableErrorCodes.has(error.code)) {
		return false;
	}
	const responses = {
		EEXIST: t(locale, 'errors.entityExists'),
		ENOENT: t(locale, 'errors.entityMissing'),
		ENTITY_KEY_COLLISION: t(locale, 'errors.entityKeyCollision'),
		ENTITY_TYPE_CHANGED: t(locale, 'errors.entityTypeChanged'),
		INVALID_ENTITY_KEY: t(locale, 'errors.invalidEntityKey'),
		INVALID_ENTITY_TYPE: t(locale, 'errors.invalidEntityType'),
	};
	const historyCodes = [
		'INVALID_CHARACTER_HISTORY',
		'INVALID_CHARACTER_HISTORY_SNAPSHOT',
		'INVALID_CREATURE_HISTORY',
		'INVALID_CREATURE_HISTORY_SNAPSHOT',
	];
	const noHistoryCodes = ['NO_CHARACTER_HISTORY', 'NO_CREATURE_HISTORY'];
	const unsupportedCodes = [
		'UNSUPPORTED_CHARACTER_HISTORY_SCHEMA',
		'UNSUPPORTED_CREATURE_HISTORY_SCHEMA',
	];
	const editorCodes = [
		'NOT_CHARACTER_EDITOR',
		'NOT_CREATURE_EDITOR',
		'NOT_ENTITY_EDITOR',
	];
	const ownerCodes = [
		'NOT_CHARACTER_OWNER',
		'NOT_CREATURE_OWNER',
		'NOT_ENTITY_OWNER',
	];
	let response = responses[error.code];
	if (error.translationKey) {
		response = translateEntityOutcome(
			error,
			locale,
			error.code.includes('CREATURE') ? 'creature' : 'character',
		);
	}
	else if (historyCodes.includes(error.code)) {
		response = t(locale, 'rpg.undo.errors.invalidBackup');
	}
	else if (noHistoryCodes.includes(error.code)) {
		response = t(locale, 'rpg.undo.errors.noHistory');
	}
	else if (unsupportedCodes.includes(error.code)) {
		response = t(locale, 'rpg.undo.errors.unsupportedSchema');
	}
	else if (editorCodes.includes(error.code)) {
		response = t(locale, 'errors.entityEditor');
	}
	else if (ownerCodes.includes(error.code)) {
		response = t(locale, 'errors.entityOwnerDelete');
	}
	else if (error.code.includes('DELETION')) {
		response = t(locale, 'rpg.delete.operationFailed');
	}
	else if (error.code.includes('HISTORY')) {
		response = t(locale, 'rpg.undo.errors.operationFailed');
	}
	await interaction.reply({
		content: response ?? error.message,
		flags: MessageFlags.Ephemeral,
	});
	return true;
}

function translateEntityOutcome(outcome, locale = 'en', type = 'character') {
	assertEntityType(type);
	return t(locale, outcome.translationKey, getTranslationVariables(
		locale,
		type,
		outcome.translationVariables,
	));
}

function getTranslationVariables(locale, type, variables = {}) {
	const translated = {
		...variables,
		apLabel: getResourceAbbreviation(locale, 'ap'),
		arLabel: getResourceAbbreviation(locale, 'ar'),
		hpLabel: getResourceAbbreviation(locale, 'hp'),
		max: variables.max ?? MAX_AP,
	};
	if (variables.fieldId) {
		translated.field = getEntityFieldLabel(locale, type, variables.fieldId);
		delete translated.fieldId;
	}
	if (variables.componentFieldId) {
		translated.component = getEntityFieldLabel(
			locale,
			type,
			variables.componentFieldId,
		);
		delete translated.componentFieldId;
	}
	return translated;
}

module.exports = {
	replyToEntityError,
	translateEntityOutcome,
};

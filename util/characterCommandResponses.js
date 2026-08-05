const { MessageFlags } = require('discord.js');
const {
	createCharacterFieldEmbed,
	createCharacterSummaryEmbed,
	formatCharacterResources,
} = require('./characterRenderer');
const { getResourceAbbreviation } = require('./characterDisplay');
const { translateCharacterOutcome } = require('./characterCommandErrors');
const { t } = require('./i18n');

function createCharacterAddedResponse(characterKey, locale = 'en') {
	return t(locale, 'rpg.add.success', { key: characterKey });
}

function createCharacterDeletedResponse(characterKey, locale = 'en') {
	return {
		content: t(locale, 'rpg.delete.success', { key: characterKey }),
		flags: MessageFlags.Ephemeral,
	};
}

function createCharacterUndoResponse(result, locale = 'en') {
	const actionKey = result.action === 'end-turn'
		? 'endTurn'
		: result.action;
	const unixTimestamp = Math.floor(Date.parse(result.createdAt) / 1_000);
	return t(locale, 'rpg.undo.success', {
		action: t(locale, `rpg.undo.actions.${actionKey}`),
		actor: `<@${result.actorId}>`,
		key: result.character.key,
		timestamp: `<t:${unixTimestamp}:F>`,
	});
}

function createCharacterDamageResponse(result, locale = 'en') {
	const { character, damage, damageAmount } = result;
	const damageBreakdown = damage.piercing
		? t(locale, 'rpg.damage.piercingBreakdown', {
			amount: damage.hpDamage,
			hpLabel: getResourceAbbreviation(locale, 'hp'),
		})
		: t(locale, 'rpg.damage.normalBreakdown', {
			arDamage: damage.arDamage,
			arLabel: getResourceAbbreviation(locale, 'ar'),
			hpDamage: damage.hpDamage,
			hpLabel: getResourceAbbreviation(locale, 'hp'),
		});
	return t(locale, 'rpg.damage.result', {
		amount: damageAmount,
		breakdown: damageBreakdown,
		name: character.displayName,
		resources: formatCharacterResources(character, ['hp', 'ar'], locale),
	});
}

function createCharacterHealResponse(result, locale = 'en') {
	const changedResources = new Set(result.changes.map(change => change.resource));
	const resourceIds = ['hp', 'ar'].filter(resourceId => changedResources.has(resourceId));
	return t(locale, 'rpg.heal.result', {
		name: result.character.displayName,
		percentage: result.percentage,
		resources: formatCharacterResources(result.character, resourceIds, locale),
	});
}

function createEndTurnResponse(result, locale = 'en') {
	return t(locale, 'rpg.endTurn.result', {
		name: result.character.displayName,
		resources: formatCharacterResources(result.character, ['ap', 'md'], locale),
	});
}

function createCharacterGetResponse(character, fieldName, locale = 'en') {
	const embed = fieldName
		? createCharacterFieldEmbed(character, fieldName, locale)
		: createCharacterSummaryEmbed(character, locale);
	if (!embed) {
		return {
			content: t(locale, 'rpg.get.unknownField', { field: fieldName }),
			flags: MessageFlags.Ephemeral,
		};
	}
	return { embeds: [embed] };
}

function createGeneratedCharacterResponse(character, locale = 'en') {
	return {
		content: t(locale, 'rpg.genChar.success', {
			key: character.key,
			name: character.displayName,
		}),
		embeds: [createCharacterSummaryEmbed(character, locale)],
	};
}

function createCharacterEditResponse(result, locale = 'en') {
	return {
		content: t(locale, 'rpg.editor.result', {
			name: result.character.displayName,
			result: translateCharacterOutcome(result.editOutcome, locale),
		}),
		flags: MessageFlags.Ephemeral,
	};
}

module.exports = {
	createCharacterAddedResponse,
	createCharacterDamageResponse,
	createCharacterDeletedResponse,
	createCharacterEditResponse,
	createCharacterGetResponse,
	createCharacterHealResponse,
	createCharacterUndoResponse,
	createEndTurnResponse,
	createGeneratedCharacterResponse,
};

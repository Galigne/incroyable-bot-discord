const { MessageFlags } = require('discord.js');
const {
	getResourceAbbreviation,
} = require('./characterDisplay');
const {
	createCharacterFieldEmbed,
	createCharacterSummaryEmbed,
} = require('./characterRenderer');
const { translateCharacterOutcome } = require('./characterCommandErrors');
const { t } = require('./i18n');

function createCharacterAddedResponse(characterKey, locale = 'en') {
	return t(locale, 'rpg.add.success', { key: characterKey });
}

function createCharacterDeletedResponse(characterKey, locale = 'en') {
	return t(locale, 'rpg.delete.success', { key: characterKey });
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
		arCurrent: character.resources.ar.current,
		arLabel: getResourceAbbreviation(locale, 'ar'),
		arMax: character.resources.ar.max,
		breakdown: damageBreakdown,
		hpCurrent: character.resources.hp.current,
		hpLabel: getResourceAbbreviation(locale, 'hp'),
		hpMax: character.resources.hp.max,
		name: character.displayName,
	});
}

function createCharacterHealResponse(result, locale = 'en') {
	const changes = result.changes.map(change => t(locale, 'rpg.heal.change', {
		current: change.current,
		max: change.max,
		previous: change.previous,
		resource: getResourceAbbreviation(locale, change.resource),
	}));
	return t(locale, 'rpg.heal.result', {
		changes: changes.join('\n'),
		name: result.character.displayName,
		percentage: result.percentage,
	});
}

function createEndTurnResponse(result, locale = 'en') {
	return t(locale, 'rpg.endTurn.result', {
		ap: result.character.resources.ap.current,
		apLabel: getResourceAbbreviation(locale, 'ap'),
		md: result.character.resources.md.current,
		mdLabel: getResourceAbbreviation(locale, 'md'),
		name: result.character.displayName,
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

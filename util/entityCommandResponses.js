const { MessageFlags } = require('discord.js');
const {
	createCharacterFieldEmbed,
	createCharacterSummaryEmbed,
} = require('./characterRenderer');
const {
	createCreatureFieldEmbed,
	createCreatureSummaryEmbed,
} = require('./creatureRenderer');
const {
	formatCombatantResources,
	getResourceAbbreviation,
} = require('./combatantDisplay');
const { translateEntityOutcome } = require('./entityCommandErrors');
const { t } = require('./i18n');
const { assertEntityType } = require('../services/entityType');

function createEntityAddedResponse(entity, locale = 'en') {
	assertEntityType(entity.type);
	return t(locale, 'rpg.add.success', {
		key: entity.key,
		type: t(locale, `entity.types.${entity.type}`),
	});
}

function createEntityDeletedResponse(entityKey, locale = 'en') {
	return {
		content: t(locale, 'rpg.delete.success', { key: entityKey }),
		flags: MessageFlags.Ephemeral,
	};
}

function createEntityUndoResponse(result, locale = 'en') {
	const actionKey = result.action === 'end-turn' ? 'endTurn' : result.action;
	const unixTimestamp = Math.floor(Date.parse(result.createdAt) / 1_000);
	return t(locale, 'rpg.undo.success', {
		action: t(locale, `rpg.undo.actions.${actionKey}`),
		actor: `<@${result.actorId}>`,
		key: result.entity.key,
		timestamp: `<t:${unixTimestamp}:F>`,
	});
}

function createEntityDamageResponse(result, locale = 'en') {
	const { entity, damage, damageAmount } = result;
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
		name: entity.displayName,
		resources: formatCombatantResources(entity, ['hp', 'ar'], locale),
	});
}

function createEntityHealResponse(result, locale = 'en') {
	const changedResources = new Set(result.changes.map(change => change.resource));
	const resourceIds = ['hp', 'ar'].filter(resourceId => changedResources.has(resourceId));
	return t(locale, 'rpg.heal.result', {
		name: result.entity.displayName,
		percentage: result.percentage,
		resources: formatCombatantResources(result.entity, resourceIds, locale),
	});
}

function createEndEntityTurnResponse(result, locale = 'en') {
	return t(locale, 'rpg.endTurn.result', {
		name: result.entity.displayName,
		resources: formatCombatantResources(result.entity, ['ap', 'md'], locale),
	});
}

function createEntityGetResponse(entity, fieldName, locale = 'en') {
	assertEntityType(entity.type);
	const embed = entity.type === 'creature'
		? fieldName
			? createCreatureFieldEmbed(entity, fieldName, locale)
			: createCreatureSummaryEmbed(entity, locale)
		: fieldName
			? createCharacterFieldEmbed(entity, fieldName, locale)
			: createCharacterSummaryEmbed(entity, locale);
	if (!embed) {
		return {
			content: t(locale, 'rpg.get.unknownField', { field: fieldName }),
			flags: MessageFlags.Ephemeral,
		};
	}
	return { embeds: [embed] };
}

function createEntityEditResponse(result, locale = 'en') {
	return {
		content: t(locale, 'rpg.editor.result', {
			name: result.entity.displayName,
			result: translateEntityOutcome(
				result.editOutcome,
				locale,
				result.entity.type,
			),
		}),
		flags: MessageFlags.Ephemeral,
	};
}

function createGeneratedCreatureResponse(creature, locale = 'en') {
	return {
		content: t(locale, 'rpg.genCreature.success', {
			key: creature.key,
			name: creature.displayName,
		}),
		embeds: [createCreatureSummaryEmbed(creature, locale)],
	};
}

module.exports = {
	createEndEntityTurnResponse,
	createEntityAddedResponse,
	createEntityDamageResponse,
	createEntityDeletedResponse,
	createEntityEditResponse,
	createEntityGetResponse,
	createEntityHealResponse,
	createEntityUndoResponse,
	createGeneratedCreatureResponse,
};

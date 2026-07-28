const path = require('node:path');
const { AttachmentBuilder, MessageFlags } = require('discord.js');
const {
	DEFAULT_DICE_LIMITS,
	DiceExpressionError,
} = require('../services/diceParser');
const { rollDiceExpression } = require('../services/diceRollService');
const { t } = require('./i18n');

const ERROR_KEYS = {
	INVALID_FORMAT: 'rpg.roll.errors.invalidFormat',
	DICE_COUNT_OUT_OF_RANGE: 'rpg.roll.errors.diceCount',
	DICE_SIDES_OUT_OF_RANGE: 'rpg.roll.errors.diceSides',
	MODIFIER_OUT_OF_RANGE: 'rpg.roll.errors.modifier',
};

function createDiceRollResponse(expression, locale) {
	let outcome;
	try {
		outcome = rollDiceExpression(expression);
	}
	catch (error) {
		if (!(error instanceof DiceExpressionError)) {
			throw error;
		}
		return {
			content: t(locale, ERROR_KEYS[error.code], DEFAULT_DICE_LIMITS),
			flags: MessageFlags.Ephemeral,
		};
	}

	if (outcome.type === 'animation') {
		return {
			files: [new AttachmentBuilder(
				path.join(__dirname, '..', 'media', outcome.animationFileName),
			)],
		};
	}

	const { result } = outcome;
	return t(locale, 'rpg.roll.result', {
		expression: result.normalized,
		modifier: result.modifier >= 0 ? `+${result.modifier}` : result.modifier,
		rolls: result.rolls.join(', '),
		total: result.total,
	});
}

module.exports = { createDiceRollResponse };

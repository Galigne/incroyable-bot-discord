const { DEFAULT_DICE_LIMITS, parseDiceExpression } = require('./diceParser');
const { rollDice } = require('./diceRoller');

function rollDiceExpression(expression, {
	limits = DEFAULT_DICE_LIMITS,
	random = Math.random,
} = {}) {
	const result = rollDice(parseDiceExpression(expression, limits), random);
	const animationFileName = getAnimationFileName(result);

	return {
		animationFileName,
		result,
		type: animationFileName ? 'animation' : 'text',
	};
}

function getAnimationFileName(result) {
	if (result.normalized === '1d2') {
		return result.rolls[0] === 1 ? 'HEADS.gif' : 'TAILS.gif';
	}
	if (result.normalized === '1d20') {
		return `D20-${result.rolls[0]}.gif`;
	}
	return null;
}

module.exports = { rollDiceExpression };

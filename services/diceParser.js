const DEFAULT_DICE_LIMITS = Object.freeze({
	maxDice: 100,
	maxSides: 1_000,
	maxModifier: 10_000,
});

class DiceExpressionError extends Error {
	constructor(code) {
		super(code);
		this.name = 'DiceExpressionError';
		this.code = code;
	}
}

function parseDiceExpression(expression, limits = DEFAULT_DICE_LIMITS) {
	if (typeof expression !== 'string') {
		throw new DiceExpressionError('INVALID_FORMAT');
	}

	const match = /^(\d+)[dD](\d+)(?:([+-])(\d+))?$/.exec(expression);
	if (!match) {
		throw new DiceExpressionError('INVALID_FORMAT');
	}

	const count = Number(match[1]);
	const sides = Number(match[2]);
	const modifierMagnitude = match[4] === undefined ? 0 : Number(match[4]);

	if (!Number.isSafeInteger(count) || count < 1 || count > limits.maxDice) {
		throw new DiceExpressionError('DICE_COUNT_OUT_OF_RANGE');
	}
	if (!Number.isSafeInteger(sides) || sides < 2 || sides > limits.maxSides) {
		throw new DiceExpressionError('DICE_SIDES_OUT_OF_RANGE');
	}
	if (
		!Number.isSafeInteger(modifierMagnitude)
		|| modifierMagnitude > limits.maxModifier
	) {
		throw new DiceExpressionError('MODIFIER_OUT_OF_RANGE');
	}

	const modifier = match[3] === '-' ? -modifierMagnitude : modifierMagnitude;
	const normalized = `${count}d${sides}${formatNormalizedModifier(modifier)}`;

	return {
		count,
		sides,
		modifier,
		normalized,
	};
}

function formatNormalizedModifier(modifier) {
	if (modifier === 0) {
		return '';
	}
	return modifier > 0 ? `+${modifier}` : String(modifier);
}

module.exports = {
	DEFAULT_DICE_LIMITS,
	DiceExpressionError,
	parseDiceExpression,
};

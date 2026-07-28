function rollDice(parsedExpression, random = Math.random) {
	const rolls = Array.from(
		{ length: parsedExpression.count },
		() => Math.floor(random() * parsedExpression.sides) + 1,
	);
	const diceTotal = rolls.reduce((total, roll) => total + roll, 0);

	return {
		...parsedExpression,
		rolls,
		total: diceTotal + parsedExpression.modifier,
	};
}

module.exports = { rollDice };

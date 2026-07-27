function sortByHelpOrder(entries) {
	return [...entries].sort((left, right) => {
		const orderDifference = left.helpOrder - right.helpOrder;
		return orderDifference || left.name.localeCompare(right.name);
	});
}

module.exports = { sortByHelpOrder };

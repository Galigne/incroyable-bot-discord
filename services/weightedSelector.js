function selectWeightedEntry(entries, random = Math.random) {
	if (!Array.isArray(entries) || entries.length === 0) {
		throw new TypeError('Weighted selection requires at least one entry.');
	}

	const totalWeight = entries.reduce(
		(total, entry) => total + getEntryWeight(entry),
		0,
	);
	if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
		throw new TypeError('Weighted selection requires a positive finite total weight.');
	}

	const randomValue = Math.max(0, Math.min(0.9999999999999999, random()));
	let target = randomValue * totalWeight;
	for (const entry of entries) {
		target -= getEntryWeight(entry);
		if (target < 0) {
			return entry;
		}
	}
	return entries.at(-1);
}

function getEntryWeight(entry) {
	const weight = entry?.weight ?? 1;
	if (!Number.isFinite(weight) || weight <= 0) {
		throw new TypeError('Weighted entries require positive finite weights.');
	}
	return weight;
}

module.exports = {
	getEntryWeight,
	selectWeightedEntry,
};

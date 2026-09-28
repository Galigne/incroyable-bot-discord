const { BASE_STATS } = require('./constants');

function createStats(data = {}) {
	const stats = {};
	for (const stat of BASE_STATS) {
		stats[stat] = data[stat] ?? 10;
	}
	return stats;
}

module.exports = {
	createStats,
};

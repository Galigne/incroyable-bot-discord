const { BASE_STATS } = require('./constants');

function createStats(data = {}) {
	const stats = {};
	for (const stat of BASE_STATS) {
		stats[stat] = data[stat] ?? 10;
	}
	stats.initiative = data.initiative ?? data.speed ?? 10;
	stats.reflexes = data.reflexes ?? data.speed ?? 10;
	return stats;
}

function recalculateDerivedStats(stats) {
	stats.initiative = stats.speed;
	stats.reflexes = stats.speed;
	return stats;
}

module.exports = {
	createStats,
	recalculateDerivedStats,
};

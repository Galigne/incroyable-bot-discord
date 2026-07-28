function canEquipArmor(constitution, constitutionRequirement) {
	return Number(constitutionRequirement) <= constitution;
}

function calculateArmorRating(maxHp, armorPercentage) {
	return Math.round(maxHp * Number(armorPercentage) / 100);
}

module.exports = {
	calculateArmorRating,
	canEquipArmor,
};

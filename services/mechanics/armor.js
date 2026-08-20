const ARMOR_CONSTITUTION_REQUIREMENTS = Object.freeze({
	light: 0,
	medium: 12,
	heavy: 14,
});

const ARMOR_PERCENTAGES = Object.freeze({
	light: Object.freeze({
		common: 5,
		uncommon: 15,
		rare: 25,
		epic: 35,
		legendary: 45,
	}),
	medium: Object.freeze({
		common: 25,
		uncommon: 35,
		rare: 45,
		epic: 55,
		legendary: 65,
	}),
	heavy: Object.freeze({
		common: 45,
		uncommon: 55,
		rare: 65,
		epic: 75,
		legendary: 85,
	}),
});

const SHIELD_PERCENTAGES = Object.freeze({
	common: 5,
	uncommon: 10,
	rare: 15,
	epic: 20,
	legendary: 25,
});

function getArmorConstitutionRequirement(armorType) {
	return ARMOR_CONSTITUTION_REQUIREMENTS[armorType];
}

function canEquipArmor(constitution, armorType) {
	const requirement = getArmorConstitutionRequirement(armorType);
	return requirement !== undefined && requirement <= constitution;
}

function getArmorPercentage(armorType, rarityId) {
	return requireMechanicalValue(
		ARMOR_PERCENTAGES[armorType]?.[rarityId],
		`Unsupported armor type or rarity: ${armorType}:${rarityId}.`,
	);
}

function getShieldPercentage(rarityId) {
	return requireMechanicalValue(
		SHIELD_PERCENTAGES[rarityId],
		`Unsupported shield rarity: ${rarityId}.`,
	);
}

function calculateArmorRating(maxHp, armorPercentage) {
	return Math.round(maxHp * Number(armorPercentage) / 100);
}

function requireMechanicalValue(value, message) {
	if (!Number.isFinite(value)) {
		throw new TypeError(message);
	}
	return value;
}

module.exports = {
	ARMOR_CONSTITUTION_REQUIREMENTS,
	ARMOR_PERCENTAGES,
	SHIELD_PERCENTAGES,
	calculateArmorRating,
	canEquipArmor,
	getArmorConstitutionRequirement,
	getArmorPercentage,
	getShieldPercentage,
};

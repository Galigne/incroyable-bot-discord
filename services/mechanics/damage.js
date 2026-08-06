const { combatantEditError } = require('./characterValidation');

function dealDamage(character, damageAmount, piercing = false) {
	if (!Number.isSafeInteger(damageAmount) || damageAmount <= 0) {
		throw combatantEditError(character, 'errors.damageInvalid');
	}
	if (typeof piercing !== 'boolean') {
		throw combatantEditError(character, 'errors.piercingInvalid');
	}

	const availableAr = Math.max(0, character.status.ar.current);
	const availableHp = Math.max(0, character.status.hp.current);
	const arDamage = piercing ? 0 : Math.min(availableAr, damageAmount);
	const damageAfterArmor = damageAmount - arDamage;
	const hpDamage = Math.min(availableHp, damageAfterArmor);

	character.status.ar.current = availableAr - arDamage;
	character.status.hp.current = availableHp - hpDamage;

	return {
		arDamage,
		hpDamage,
		piercing,
	};
}

module.exports = {
	dealDamage,
};

const { characterEditError } = require('./characterValidation');

function dealDamage(character, damageAmount, piercing = false) {
	if (!Number.isSafeInteger(damageAmount) || damageAmount <= 0) {
		throw characterEditError('errors.damageInvalid');
	}
	if (typeof piercing !== 'boolean') {
		throw characterEditError('errors.piercingInvalid');
	}

	const availableAr = Math.max(0, character.resources.ar.current);
	const availableHp = Math.max(0, character.resources.hp.current);
	const arDamage = piercing ? 0 : Math.min(availableAr, damageAmount);
	const damageAfterArmor = damageAmount - arDamage;
	const hpDamage = Math.min(availableHp, damageAfterArmor);

	character.resources.ar.current = availableAr - arDamage;
	character.resources.hp.current = availableHp - hpDamage;

	return {
		arDamage,
		hpDamage,
		piercing,
	};
}

module.exports = {
	dealDamage,
};

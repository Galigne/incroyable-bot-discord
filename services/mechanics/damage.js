const { characterEditError } = require('./characterValidation');
const { t } = require('../../util/i18n');

function dealDamage(character, damageAmount, piercing = false, locale = 'en') {
	if (!Number.isSafeInteger(damageAmount) || damageAmount <= 0) {
		throw characterEditError(t(locale, 'errors.damageInvalid'));
	}
	if (typeof piercing !== 'boolean') {
		throw characterEditError(t(locale, 'errors.piercingInvalid'));
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

const { t } = require('./i18n');

function createLocalizedCharacterGenerationOptions(options, locale = 'en') {
	return {
		...options,
		locale,
		formatGold: gold => t(locale, 'character.generatedGold', { gold }),
	};
}

module.exports = { createLocalizedCharacterGenerationOptions };

const { createCharacterSummaryEmbed } = require('./characterRenderer');
const { t } = require('./i18n');

function createGeneratedCharacterResponse(character, locale = 'en') {
	return {
		content: t(locale, 'rpg.genChar.success', {
			key: character.key,
			name: character.displayName,
		}),
		embeds: [createCharacterSummaryEmbed(character, locale)],
	};
}

module.exports = {
	createGeneratedCharacterResponse,
};

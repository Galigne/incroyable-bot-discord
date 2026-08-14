const { createCharacterSummaryEmbed } = require('./characterRenderer');
const {
	createEntityGearResponse,
	createEntityGetResponse,
} = require('./entityCommandResponses');
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

function createGeneratedCharacterFollowUpResponses(character, locale = 'en') {
	return [
		createEntityGetResponse(character, 'personality', locale),
		createEntityGearResponse(character, locale),
	].filter(Boolean);
}

module.exports = {
	createGeneratedCharacterResponse,
	createGeneratedCharacterFollowUpResponses,
};

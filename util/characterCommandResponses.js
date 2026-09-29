const { MessageFlags } = require('discord.js');
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
		flags: MessageFlags.Ephemeral,
	};
}

function createGeneratedCharacterFollowUpResponses(character, locale = 'en') {
	return [
		createEntityGetResponse(character, 'personality', locale),
		createEntityGearResponse(character, locale),
	].filter(Boolean).map(response => ({
		...response,
		flags: MessageFlags.Ephemeral,
	}));
}

module.exports = {
	createGeneratedCharacterResponse,
	createGeneratedCharacterFollowUpResponses,
};

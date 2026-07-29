const RULES_URLS = {
	en: 'https://github.com/Galigne/incroyable-bot-discord/blob/master/documentation/TTRPG_RANDOM_RULES_EN.md',
	fr: 'https://github.com/Galigne/incroyable-bot-discord/blob/master/documentation/JDR_RANDOM_RULES_FR.md',
};
const { getLocale, t } = require('../../../util/i18n');

module.exports = {
	async execute({ config, interaction }) {
		const locale = getLocale(config, interaction.guildId);
		await interaction.reply(t(
			locale,
			'rpg.rules.reply',
			{ url: RULES_URLS[locale] },
		));
	},
};

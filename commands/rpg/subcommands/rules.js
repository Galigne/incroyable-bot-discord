const RULES_URLS = {
	en: 'https://github.com/Galigne/incroyable-bot-discord/blob/master/documentation/TTRPG_RANDOM_RULES_EN.md',
	fr: 'https://github.com/Galigne/incroyable-bot-discord/blob/master/documentation/JDR_RANDOM_RULES_FR.md',
};
const { getLocale, localizeDescription, t } = require('../../../util/i18n');

const descriptionKey = 'rpg.rules.description';

module.exports = {
	name: 'rules',
	description: t('en', descriptionKey),
	descriptionKey,
	usage: '/rpg rules',
	helpOrder: 80,
	configure: command => localizeDescription(command.setName('rules'), descriptionKey),
	async execute({ config, interaction }) {
		const locale = getLocale(config, interaction.guildId);
		await interaction.reply(t(
			locale,
			'rpg.rules.reply',
			{ url: RULES_URLS[locale] },
		));
	},
};

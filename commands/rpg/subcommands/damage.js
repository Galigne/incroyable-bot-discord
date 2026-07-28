const characterStore = require('../../../services/characterStore');
const { dealDamage } = require('../../../services/mechanics/damage');
const { canManageCharacters } = require('../../../util/characterAuthorization');
const { replyToCharacterError } = require('../../../util/characterCommandErrors');
const { filterAutocompleteChoices } = require('../../../util/autocomplete');
const { getCharacterChoices } = require('../autocomplete');
const { getLocale, localizeDescription, t } = require('../../../util/i18n');
const { getResourceAbbreviation } = require('../../../util/characterDisplay');

const COMMON_DAMAGE_AMOUNTS = [1, 5, 10, 15, 20, 25, 50, 100];
const descriptionKey = 'rpg.damage.description';

module.exports = {
	name: 'damage',
	description: t('en', descriptionKey),
	descriptionKey,
	usage: '/rpg damage character-key:<key> damage-amount:<number> [piercing]',
	helpOrder: 55,
	configure: command => localizeDescription(command.setName('damage'), descriptionKey)
		.addStringOption(option => localizeDescription(
			option.setName('character-key'),
			'rpg.damage.characterOption',
		)
			.setAutocomplete(true)
			.setRequired(true))
		.addIntegerOption(option => localizeDescription(
			option.setName('damage-amount'),
			'rpg.damage.amountOption',
		)
			.setMinValue(1)
			.setAutocomplete(true)
			.setRequired(true))
		.addBooleanOption(option => localizeDescription(
			option.setName('piercing'),
			'rpg.damage.piercingOption',
		)),
	async autocomplete({ config, interaction }) {
		const locale = getLocale(config, interaction.guildId);
		const focused = interaction.options.getFocused(true);
		if (focused.name === 'character-key') {
			await interaction.respond(await getCharacterChoices(focused.value));
			return;
		}
		await interaction.respond(filterAutocompleteChoices(
			COMMON_DAMAGE_AMOUNTS.map(value => ({
				name: t(locale, 'rpg.damage.choice', { amount: value }),
				value,
			})),
			focused.value,
		));
	},
	async execute({ config, interaction }) {
		const locale = getLocale(config, interaction.guildId);
		const characterKey = interaction.options.getString('character-key', true);
		const damageAmount = interaction.options.getInteger('damage-amount', true);
		const piercing = interaction.options.getBoolean('piercing') ?? false;

		try {
			let damageResult;
			const character = await characterStore.updateCharacter(
				characterKey,
				interaction.user.id,
				canManageCharacters(interaction, config),
				currentCharacter => {
					damageResult = dealDamage(currentCharacter, damageAmount, piercing, locale);
				},
			);
			const damageBreakdown = piercing
				? t(locale, 'rpg.damage.piercingBreakdown', {
					amount: damageResult.hpDamage,
					hpLabel: getResourceAbbreviation(locale, 'hp'),
				})
				: t(locale, 'rpg.damage.normalBreakdown', {
					arDamage: damageResult.arDamage,
					arLabel: getResourceAbbreviation(locale, 'ar'),
					hpDamage: damageResult.hpDamage,
					hpLabel: getResourceAbbreviation(locale, 'hp'),
				});
			await interaction.reply(t(locale, 'rpg.damage.result', {
				amount: damageAmount,
				arCurrent: character.resources.ar.current,
				arLabel: getResourceAbbreviation(locale, 'ar'),
				arMax: character.resources.ar.max,
				breakdown: damageBreakdown,
				hpCurrent: character.resources.hp.current,
				hpLabel: getResourceAbbreviation(locale, 'hp'),
				hpMax: character.resources.hp.max,
				name: character.displayName,
			}));
		}
		catch (error) {
			if (!await replyToCharacterError(interaction, error, locale)) {
				throw error;
			}
		}
	},
};

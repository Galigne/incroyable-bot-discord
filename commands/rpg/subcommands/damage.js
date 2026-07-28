const characterStore = require('../../../services/characterStore');
const { dealDamage } = require('../../../services/characterEditor');
const { canManageCharacters } = require('../../../util/characterAuthorization');
const { replyToCharacterError } = require('../../../util/characterCommandErrors');
const { filterAutocompleteChoices } = require('../../../util/autocomplete');
const { getCharacterChoices } = require('../autocomplete');

const COMMON_DAMAGE_AMOUNTS = [1, 5, 10, 15, 20, 25, 50, 100];

module.exports = {
	name: 'damage',
	description: 'Deal damage to a character, reducing AR before HP',
	usage: '/rpg damage character-key:<key> damage-amount:<number> [piercing]',
	helpOrder: 55,
	configure: command => command
		.setName('damage')
		.setDescription('Deal damage to a character, reducing AR before HP')
		.addStringOption(option => option
			.setName('character-key')
			.setDescription('Character receiving the damage')
			.setAutocomplete(true)
			.setRequired(true))
		.addIntegerOption(option => option
			.setName('damage-amount')
			.setDescription('Positive amount of damage to deal')
			.setMinValue(1)
			.setAutocomplete(true)
			.setRequired(true))
		.addBooleanOption(option => option
			.setName('piercing')
			.setDescription('Bypass AR and deal the damage directly to HP')),
	async autocomplete({ interaction }) {
		const focused = interaction.options.getFocused(true);
		if (focused.name === 'character-key') {
			await interaction.respond(await getCharacterChoices(focused.value));
			return;
		}
		await interaction.respond(filterAutocompleteChoices(
			COMMON_DAMAGE_AMOUNTS.map(value => ({
				name: `${value} damage`,
				value,
			})),
			focused.value,
		));
	},
	async execute({ config, interaction }) {
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
					damageResult = dealDamage(currentCharacter, damageAmount, piercing);
				},
			);
			const damageBreakdown = piercing
				? `${damageResult.hpDamage} piercing damage was dealt directly to HP.`
				: `${damageResult.arDamage} damage was absorbed by AR and `
					+ `${damageResult.hpDamage} damage reached HP.`;
			await interaction.reply(
				`**${character.displayName}** received **${damageAmount} damage**. `
					+ `${damageBreakdown}\n`
					+ `AR: **${character.resources.ar.current}/${character.resources.ar.max}** · `
					+ `HP: **${character.resources.hp.current}/${character.resources.hp.max}**`,
			);
		}
		catch (error) {
			if (!await replyToCharacterError(interaction, error)) {
				throw error;
			}
		}
	},
};

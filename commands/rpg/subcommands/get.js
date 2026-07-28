const { MessageFlags } = require('discord.js');
const characterStore = require('../../../services/characterStore');
const { filterAutocompleteChoices } = require('../../../util/autocomplete');
const { getCharacterChoices } = require('../autocomplete');

const GET_FIELDS = [
	'name',
	'firstName',
	'lastName',
	'level',
	'race',
	'appearance',
	'backstory',
	'goals',
	'personality',
	'racialTraits',
	'statistics',
	'rules',
	'talents',
	'status',
	'HP',
	'AR',
	'AP',
	'MD',
	'statusEffects',
	'equipment',
	'inventory',
	'encumbrance',
];

const GET_HELP = [
	'Use `/rpg get` to display a character-sheet summary.',
	'Select the optional `field` to display one complete field and its sub-fields.',
	'',
	'**Available fields**',
	'`name` — first name and last name',
	'`firstName`, `lastName`, `level`',
	'`race` — name, physical description, and lore',
	'`appearance`, `backstory`, `goals`',
	'`personality` — traits and additional description',
	'`racialTraits` — skill bonus and physical ability',
	'`statistics` — base and derived statistics',
	'`rules` — every RULE name, level, and description',
	'`talents`',
	'`status` — HP, AR, AP, MD, encumbrance, and status effects',
	'`HP`, `AR`, `AP`, `MD` — one resource only',
	'`statusEffects`, `equipment`, `inventory`, `encumbrance`',
	'',
	'**Examples**',
	'Select CharacterKey `D.Robert` for the summary.',
	'Then optionally select `name`, `personality`, `race`, `rules`, or `status`.',
].join('\n');

module.exports = {
	name: 'get',
	description: 'Display a character summary or one detailed field',
	usage: '/rpg get character-key:<key> [field]',
	helpOrder: 30,
	configure: command => command
		.setName('get')
		.setDescription('Display a character summary or one detailed field')
		.addStringOption(option => option
			.setName('character-key')
			.setDescription('Character to display')
			.setAutocomplete(true)
			.setRequired(true))
		.addStringOption(option => option
			.setName('field')
			.setDescription('Optional detailed field')
			.setAutocomplete(true)),
	async autocomplete({ interaction }) {
		const focused = interaction.options.getFocused(true);
		if (focused.name === 'character-key') {
			await interaction.respond(await getCharacterChoices(focused.value));
			return;
		}
		await interaction.respond(filterAutocompleteChoices(
			GET_FIELDS.map(field => ({ name: field, value: field })),
			focused.value,
		));
	},
	async execute({ interaction }) {
		const name = interaction.options.getString('character-key', true);
		const fieldName = interaction.options.getString('field');
		try {
			const character = await characterStore.getCharacter(name);
			const embed = fieldName
				? character.toFieldEmbed(fieldName)
				: character.toEmbed();
			if (!embed) {
				await interaction.reply({
					content: `Unknown character field: **${fieldName}**. `
						+ 'Use `/rpg get-help` to list the available fields.',
					flags: MessageFlags.Ephemeral,
				});
				return;
			}
			embed.setFooter({
				text: fieldName
					? `Character key: ${name}`
					: 'Use /rpg get with the field option for more details.',
			});
			await interaction.reply({ embeds: [embed] });
		}
		catch (error) {
			if (error.code === 'ENOENT') {
				await interaction.reply({
					content: 'That character does not exist.',
					flags: MessageFlags.Ephemeral,
				});
				return;
			}
			if (error.code === 'INVALID_CHARACTER_NAME') {
				await interaction.reply({
					content: error.message,
					flags: MessageFlags.Ephemeral,
				});
				return;
			}
			throw error;
		}
	},
};

module.exports.GET_FIELDS = GET_FIELDS;
module.exports.GET_HELP = GET_HELP;

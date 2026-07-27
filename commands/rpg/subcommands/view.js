const characterStore = require('../../../services/characterStore');
const { filterAutocompleteChoices } = require('../../../util/autocomplete');
const { getCharacterChoices } = require('../autocomplete');

const VIEW_FIELDS = [
	'name',
	'firstName',
	'lastName',
	'level',
	'race',
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

const VIEW_HELP = [
	'Use `/rpg view` to display a character-sheet summary.',
	'Select the optional `field` to display one complete field and its sub-fields.',
	'',
	'**Available fields**',
	'`name` — first name and last name',
	'`firstName`, `lastName`, `level`',
	'`race` — name, physical description, and lore',
	'`backstory`, `goals`',
	'`personality` — traits and additional description',
	'`racialTraits` — skill bonus and physical ability',
	'`statistics` — base and derived statistics',
	'`rules` — every RULE name and description',
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
	name: 'view',
	description: 'Display a character summary or one detailed field',
	usage: '/rpg view character-key:<key> [field]',
	helpOrder: 30,
	configure: command => command
		.setName('view')
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
			VIEW_FIELDS.map(field => ({ name: field, value: field })),
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
						+ 'Use `/rpg view-help` to list the available fields.',
					ephemeral: true,
				});
				return;
			}
			embed.setFooter({
				text: fieldName
					? `Character key: ${name}`
					: 'Use /rpg view with the field option for more details.',
			});
			await interaction.reply({ embeds: [embed] });
		}
		catch (error) {
			if (error.code === 'ENOENT') {
				await interaction.reply({
					content: 'That character does not exist.',
					ephemeral: true,
				});
				return;
			}
			if (error.code === 'INVALID_CHARACTER_NAME') {
				await interaction.reply({ content: error.message, ephemeral: true });
				return;
			}
			throw error;
		}
	},
};

module.exports.VIEW_FIELDS = VIEW_FIELDS;
module.exports.VIEW_HELP = VIEW_HELP;

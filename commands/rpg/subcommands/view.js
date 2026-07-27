const characterStore = require('../../../services/characterStore');

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
	'Use `!rpg view <characterKey>` to display the character-sheet summary.',
	'Use `!rpg view <characterKey> <field>` to display one complete field and its sub-fields.',
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
	'`!rpg view D.Robert`',
	'`!rpg view D.Robert name`',
	'`!rpg view D.Robert personality`',
	'`!rpg view D.Robert race`',
	'`!rpg view D.Robert rules`',
	'`!rpg view D.Robert status`',
].join('\n');

module.exports = {
	name: 'view',
	description: 'Display a character summary or one detailed field',
	usage: '!rpg view <characterKey> [field]',
	helpOrder: 30,
	async execute({ args, message }) {
		const [name, fieldName] = args;
		if (!name) {
			await message.reply('Usage: `!rpg view <characterKey> [field]`');
			return;
		}
		try {
			const character = await characterStore.getCharacter(name);
			const embed = fieldName
				? character.toFieldEmbed(fieldName)
				: character.toEmbed();
			if (!embed) {
				await message.reply(
					`Unknown character field: **${fieldName}**. `
					+ 'Use `!rpg viewHelp` to list the available fields.',
				);
				return;
			}
			embed.setFooter({
				text: fieldName
					? `Character key: ${name}`
					: `Use !rpg view ${name} <field> for more details.`,
			});
			await message.channel.send({ embeds: [embed] });
		}
		catch (error) {
			if (error.code === 'ENOENT') {
				await message.reply('That character does not exist.');
				return;
			}
			if (error.code === 'INVALID_CHARACTER_NAME') {
				await message.reply(error.message);
				return;
			}
			throw error;
		}
	},
};

module.exports.VIEW_FIELDS = VIEW_FIELDS;
module.exports.VIEW_HELP = VIEW_HELP;

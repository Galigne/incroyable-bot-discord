const { editCharacter } = require('../../../services/characterEditor');
const characterStore = require('../../../services/characterStore');
const { canManageCharacters } = require('../../../util/characterAuthorization');
const { replyToCharacterError } = require('../../../util/characterCommandErrors');

const EDIT_HELP = [
	'Use `!rpg edit <character> <field> <value>` to change one part of a sheet.',
	'Fields inside another field use a dot: `race.name`, `stats.strength`, or `hp.current`.',
	'Use `clear` as the value to empty a text field.',
	'',
	'**Text and number fields**',
	'`name`, `level`, `backstory`, `goals`, `talents`',
	'`race.name`, `race.description`, `race.lore`',
	'`personality.description`',
	'`racialTrait.skillBonus`, `racialTrait.physicalAbility`',
	'`stats.constitution`, `stats.strength`, `stats.dexterity`, `stats.intelligence`,',
	'`stats.speed`, `stats.perception`, `stats.charisma`, `stats.initiative`, `stats.reflexes`',
	'`hp.current`, `hp.max`, `ar.current`, `ar.max`, `ap.current`, `ap.max`,',
	'`md.current`, `md.max`, `encumbrance.current`, `encumbrance.max`',
	'AP values must be whole numbers with `0 ≤ current ≤ max ≤ 10`.',
	'',
	'**List fields**',
	'`personality.traits`, `rules`, `statusEffects`, `equipment`, `inventory`',
	'',
	'List actions:',
	'`add <value>` — append an item',
	'`set <position> <value>` — replace an item using its number in the displayed list',
	'`remove <position>` — remove one item',
	'`clear` — remove every item',
	'',
	'**Examples**',
	'`!rpg edit Aria race.name Elf`',
	'`!rpg edit Aria stats.strength 14`',
	'`!rpg edit Aria personality.traits add Brave`',
	'`!rpg edit Aria personality.traits set 1 Fearless`',
	'`!rpg edit Aria personality.traits remove 1`',
	'`!rpg edit Aria rules add Fire | Controls nearby flames`',
	'`!rpg edit Aria equipment set 1 Runed longsword`',
	'`!rpg edit Aria statusEffects clear`',
].join('\n');

module.exports = {
	name: 'edit',
	description: 'Edit one field of a character sheet',
	usage: '!rpg edit <character> <field> <value>',
	helpOrder: 40,
	async execute({ args, config, message }) {
		const [characterName, fieldName, ...fieldArgs] = args;
		if (!characterName || !fieldName) {
			await message.reply(
				'Usage: `!rpg edit <character> <field> <value>`. '
				+ 'Use `!rpg editHelp` for editing instructions.',
			);
			return;
		}

		try {
			let editResult;
			const character = await characterStore.updateCharacter(
				characterName,
				message.author.id,
				canManageCharacters(message, config),
				currentCharacter => {
					editResult = editCharacter(currentCharacter, fieldName, fieldArgs);
				},
			);
			await message.reply(`Character **${character.name}**: ${editResult}`);
		}
		catch (error) {
			if (!await replyToCharacterError(message, error)) {
				throw error;
			}
		}
	},
};

module.exports.EDIT_HELP = EDIT_HELP;

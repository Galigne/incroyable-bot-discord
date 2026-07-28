const {
	generateCharacter,
} = require('../../../services/characterApplicationService');
const generatorCatalog = require('../../../services/generatorCatalog');
const {
	createGeneratedCharacterResponse,
} = require('../../../util/characterCommandResponses');
const {
	createLocalizedCharacterGenerationOptions,
} = require('../../../util/characterGenerationLocalization');
const { replyToCharacterError } = require('../../../util/characterCommandErrors');
const { filterAutocompleteChoices } = require('../../../util/autocomplete');
const { getLocale, localizeDescription, t } = require('../../../util/i18n');

const descriptionKey = 'rpg.genChar.description';

module.exports = {
	name: 'gen-char',
	description: t('en', descriptionKey),
	descriptionKey,
	usage: '/rpg gen-char character-key:<new key> [level] [background]',
	helpOrder: 11,
	access: {
		permission: 'dm',
	},
	configure: command => localizeDescription(
		command.setName('gen-char'),
		'rpg.genChar.schemaDescription',
	)
		.addStringOption(option => localizeDescription(
			option.setName('character-key'),
			'rpg.genChar.keyOption',
		)
			.setMinLength(1)
			.setMaxLength(50)
			.setRequired(true))
		.addIntegerOption(option => localizeDescription(
			option.setName('level'),
			'rpg.genChar.levelOption',
		)
			.setMinValue(1)
			.setMaxValue(10)
			.setAutocomplete(true))
		.addStringOption(option => localizeDescription(
			option.setName('background'),
			'rpg.genChar.backgroundOption',
		)
			.setAutocomplete(true)),
	async autocomplete({ config, interaction }) {
		const locale = getLocale(config, interaction.guildId);
		const focused = interaction.options.getFocused(true);
		if (focused.name === 'level') {
			const levels = Array.from({ length: 10 }, (_, index) => index + 1);
			await interaction.respond(filterAutocompleteChoices(
				levels.map(level => ({
					name: t(locale, 'rpg.genChar.levelChoice', { level }),
					value: level,
				})),
				focused.value,
			));
			return;
		}
		const englishBackgrounds = generatorCatalog.getGenerator('background', 'en')?.entries ?? [];
		const backgrounds = generatorCatalog.getGenerator('background', locale)?.entries ?? [];
		await interaction.respond(filterAutocompleteChoices(
			backgrounds.map((entry, index) => ({
				name: `${entry.fields.Name} — ${entry.fields.Description}`.slice(0, 100),
				value: englishBackgrounds[index].fields.Name,
			})),
			focused.value,
		));
	},
	async execute({ config, interaction }) {
		const locale = getLocale(config, interaction.guildId);
		const characterKey = interaction.options.getString('character-key', true);
		const level = interaction.options.getInteger('level');
		const background = interaction.options.getString('background');
		try {
			const character = await generateCharacter(
				characterKey,
				interaction.user.id,
				createLocalizedCharacterGenerationOptions({ background, level }, locale),
			);
			await interaction.reply(createGeneratedCharacterResponse(character, locale));
		}
		catch (error) {
			if (!await replyToCharacterError(interaction, error, locale)) {
				throw error;
			}
		}
	},
};

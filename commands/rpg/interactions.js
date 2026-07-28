const {
	LabelBuilder,
	MessageFlags,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
} = require('discord.js');
const {
	getEditableFieldValue,
	setEditableFieldValue,
} = require('../../services/characterEditor');
const characterStore = require('../../services/characterStore');
const { canManageCharacter } = require('../../util/authorization');
const { replyToCharacterError } = require('../../util/characterCommandErrors');
const {
	createInteractionSession,
	deleteInteractionSession,
	getInteractionSession,
} = require('../../util/interactionSessions');
const {
	EDIT_FIELDS,
	getEditFieldLabel,
	MULTILINE_COLLECTION_FIELDS,
	PARAGRAPH_FIELDS,
} = require('./editorFields');
const { getLocale, t } = require('../../util/i18n');

async function openCharacterEditor(interaction, config, characterKey, fieldName) {
	const locale = getLocale(config, interaction.guildId);
	try {
		const normalizedField = findEditableField(fieldName);
		if (!normalizedField) {
			await interaction.reply({
				content: t(locale, 'rpg.editor.unknownField', { field: fieldName }),
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const character = await getEditableCharacter(
			characterKey,
			currentCharacter => canManageCharacter(interaction, currentCharacter, config),
		);
		const value = getEditableFieldValue(character, normalizedField);
		if (value.length > 4_000) {
			await interaction.reply({
				content: t(locale, 'rpg.editor.tooLarge'),
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const session = createInteractionSession('set', interaction.user.id, {
			characterKey,
			fieldName: normalizedField,
		});
		await interaction.showModal(createFieldModal(session.id, normalizedField, value, locale));
	}
	catch (error) {
		if (!await replyToCharacterError(interaction, error, locale)) {
			throw error;
		}
	}
}

async function handleRpgInteraction(interaction, config) {
	if (!interaction.isModalSubmit() || !interaction.customId.startsWith('rpg-set:')) {
		return false;
	}
	const locale = getLocale(config, interaction.guildId);

	const sessionId = interaction.customId.slice('rpg-set:'.length);
	const session = getInteractionSession(sessionId, interaction.user.id, 'set');
	if (!session) {
		await interaction.reply({
			content: t(locale, 'rpg.editor.expired'),
			flags: MessageFlags.Ephemeral,
		});
		return true;
	}

	try {
		let editResult;
		const character = await characterStore.updateCharacter(
			session.characterKey,
			currentCharacter => canManageCharacter(interaction, currentCharacter, config),
			currentCharacter => {
				editResult = setEditableFieldValue(
					currentCharacter,
					session.fieldName,
					interaction.fields.getTextInputValue('field-value'),
					locale,
				);
			},
		);
		deleteInteractionSession(session.id);
		await interaction.reply({
			content: t(locale, 'rpg.editor.result', {
				name: character.displayName,
				result: editResult,
			}),
			flags: MessageFlags.Ephemeral,
		});
	}
	catch (error) {
		if (!await replyToCharacterError(interaction, error, locale)) {
			throw error;
		}
	}
	return true;
}

function createFieldModal(sessionId, fieldName, value, locale = 'en') {
	const normalizedField = fieldName.toLowerCase();
	const isCollection = MULTILINE_COLLECTION_FIELDS.has(normalizedField);
	const label = getEditFieldLabel(fieldName, locale);
	const input = new TextInputBuilder()
		.setCustomId('field-value')
		.setStyle(PARAGRAPH_FIELDS.has(normalizedField)
			? TextInputStyle.Paragraph
			: TextInputStyle.Short)
		.setMaxLength(4_000)
		.setRequired(!isTextField(fieldName));

	if (value) {
		input.setValue(value);
	}
	else {
		input.setPlaceholder(isCollection
			? t(locale, 'rpg.editor.collectionPlaceholder')
			: t(locale, 'rpg.editor.valuePlaceholder'));
	}

	let description;
	if (fieldName === 'rules') {
		description = t(locale, 'rpg.editor.rulesDescription');
	}
	else if (isCollection) {
		description = t(locale, 'rpg.editor.collectionDescription');
	}
	else if (isTextField(fieldName)) {
		description = t(locale, 'rpg.editor.textDescription');
	}
	else {
		description = t(locale, 'rpg.editor.numberDescription');
	}

	return new ModalBuilder()
		.setCustomId(`rpg-set:${sessionId}`)
		.setTitle(t(locale, 'rpg.editor.title', { field: label }).slice(0, 45))
		.addLabelComponents(
			new LabelBuilder()
				.setLabel(label.slice(0, 45))
				.setDescription(description.slice(0, 100))
				.setTextInputComponent(input),
		);
}

async function getEditableCharacter(characterKey, canManage) {
	const character = await characterStore.getCharacter(characterKey);
	if (!canManage(character)) {
		const error = new Error('Only the character creator or a DM can edit it.');
		error.code = 'NOT_CHARACTER_EDITOR';
		throw error;
	}
	return character;
}

function findEditableField(fieldName) {
	return EDIT_FIELDS.find(field => field.toLowerCase() === fieldName.toLowerCase());
}

function isTextField(fieldName) {
	return !(
		fieldName === 'level'
		|| fieldName.startsWith('stats.')
		|| /^(hp|ar|ap|md|encumbrance)\./i.test(fieldName)
	);
}

module.exports = {
	createFieldModal,
	handleRpgInteraction,
	openCharacterEditor,
};

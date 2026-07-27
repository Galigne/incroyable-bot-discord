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
const { canManageCharacters } = require('../../util/characterAuthorization');
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

async function openCharacterEditor(interaction, config, characterKey, fieldName) {
	try {
		const normalizedField = findEditableField(fieldName);
		if (!normalizedField) {
			await interaction.reply({
				content: `Unknown editable field: **${fieldName}**.`,
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const character = await getEditableCharacter(
			characterKey,
			interaction.user.id,
			canManageCharacters(interaction, config),
		);
		const value = getEditableFieldValue(character, normalizedField);
		if (value.length > 4_000) {
			await interaction.reply({
				content: 'This field is larger than Discord’s 4,000-character modal limit.',
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const session = createInteractionSession('edit', interaction.user.id, {
			characterKey,
			fieldName: normalizedField,
		});
		await interaction.showModal(createFieldModal(session.id, normalizedField, value));
	}
	catch (error) {
		if (!await replyToCharacterError(interaction, error)) {
			throw error;
		}
	}
}

async function handleRpgInteraction(interaction, config) {
	if (!interaction.isModalSubmit() || !interaction.customId.startsWith('rpg-edit:')) {
		return false;
	}

	const sessionId = interaction.customId.slice('rpg-edit:'.length);
	const session = getInteractionSession(sessionId, interaction.user.id, 'edit');
	if (!session) {
		await interaction.reply({
			content: 'This edit form expired. Run `/rpg edit` again.',
			flags: MessageFlags.Ephemeral,
		});
		return true;
	}

	try {
		let editResult;
		const character = await characterStore.updateCharacter(
			session.characterKey,
			interaction.user.id,
			canManageCharacters(interaction, config),
			currentCharacter => {
				editResult = setEditableFieldValue(
					currentCharacter,
					session.fieldName,
					interaction.fields.getTextInputValue('field-value'),
				);
			},
		);
		deleteInteractionSession(session.id);
		await interaction.reply({
			content: `**${character.displayName}**: ${editResult}`,
			flags: MessageFlags.Ephemeral,
		});
	}
	catch (error) {
		if (!await replyToCharacterError(interaction, error)) {
			throw error;
		}
	}
	return true;
}

function createFieldModal(sessionId, fieldName, value) {
	const normalizedField = fieldName.toLowerCase();
	const isCollection = MULTILINE_COLLECTION_FIELDS.has(normalizedField);
	const label = getEditFieldLabel(fieldName);
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
			? 'Write one entry per line; leading dashes are optional'
			: 'Enter the new value');
	}

	let description;
	if (fieldName === 'rules') {
		description = 'One RULE per line: Name: Description. Leading dashes are optional.';
	}
	else if (isCollection) {
		description = 'Free-form lines; leading dashes are optional. Empty the form to clear.';
	}
	else if (isTextField(fieldName)) {
		description = 'The previous value is prefilled. Empty the form to clear it.';
	}
	else {
		description = 'Enter a valid number.';
	}

	return new ModalBuilder()
		.setCustomId(`rpg-edit:${sessionId}`)
		.setTitle(`Edit ${label}`.slice(0, 45))
		.addLabelComponents(
			new LabelBuilder()
				.setLabel(label.slice(0, 45))
				.setDescription(description.slice(0, 100))
				.setTextInputComponent(input),
		);
}

async function getEditableCharacter(characterKey, userId, canManage) {
	const character = await characterStore.getCharacter(characterKey);
	if (character.creatorId !== userId && !canManage) {
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

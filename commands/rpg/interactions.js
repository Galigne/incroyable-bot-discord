const {
	LabelBuilder,
	MessageFlags,
	ModalBuilder,
	TextDisplayBuilder,
	TextInputBuilder,
	TextInputStyle,
} = require('discord.js');
const {
	deleteCharacter,
	getDeletableCharacter,
	getEditableCharacterField,
	updateEditableCharacter,
} = require('../../services/characterApplicationService');
const { canManageCharacter } = require('../../util/authorization');
const {
	createCharacterDeletedResponse,
	createCharacterEditResponse,
} = require('../../util/characterCommandResponses');
const {
	replyToCharacterError,
} = require('../../util/characterCommandErrors');
const { getCharacterFieldLabel } = require('../../util/characterDisplay');
const {
	createCharacterHistoryContext,
} = require('../../util/characterHistoryContext');
const {
	consumeInteractionSession,
	createInteractionSession,
	deleteInteractionSession,
	getInteractionSession,
} = require('../../util/interactionSessions');
const {
	getEditFieldLabel,
	getEditInputId,
	getEditTargetDefinitions,
} = require('./editorFields');
const { getEditableFieldDefinition } = require('../../services/characterFieldCatalog');
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

		const editorState = await getEditableCharacterField(
			characterKey,
			normalizedField,
			currentCharacter => canManageCharacter(interaction, currentCharacter, config),
		);
		const value = editorState.value;
		if (isValueTooLarge(value)) {
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

async function openCharacterDeletionConfirmation(
	interaction,
	config,
	characterKey,
) {
	const locale = getLocale(config, interaction.guildId);
	try {
		await getDeletableCharacter(
			characterKey,
			currentCharacter => canManageCharacter(interaction, currentCharacter, config),
		);
		const session = createInteractionSession('delete', interaction.user.id, {
			characterKey,
		});
		await interaction.showModal(createDeletionModal(session.id, characterKey, locale));
	}
	catch (error) {
		if (!await replyToCharacterError(interaction, error, locale)) {
			throw error;
		}
	}
}

async function handleRpgInteraction(interaction, config) {
	if (!interaction.isModalSubmit()) {
		return false;
	}
	if (interaction.customId.startsWith('rpg-set:')) {
		return handleCharacterEditSubmission(interaction, config);
	}
	if (interaction.customId.startsWith('rpg-delete:')) {
		return handleCharacterDeletionSubmission(interaction, config);
	}
	return false;
}

async function handleCharacterEditSubmission(interaction, config) {
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
		const result = await updateEditableCharacter(
			session.characterKey,
			session.fieldName,
			getSubmittedFieldValue(interaction, session.fieldName),
			currentCharacter => canManageCharacter(interaction, currentCharacter, config),
			createCharacterHistoryContext(interaction, config),
		);
		deleteInteractionSession(session.id);
		await interaction.reply(createCharacterEditResponse(result, locale));
	}
	catch (error) {
		if (!await replyToCharacterError(interaction, error, locale)) {
			throw error;
		}
	}
	return true;
}

async function handleCharacterDeletionSubmission(interaction, config) {
	const locale = getLocale(config, interaction.guildId);
	const sessionId = interaction.customId.slice('rpg-delete:'.length);
	const consumed = consumeInteractionSession(
		sessionId,
		interaction.user.id,
		'delete',
	);
	if (consumed.status === 'wrong-user') {
		await interaction.reply({
			content: t(locale, 'rpg.delete.wrongUser'),
			flags: MessageFlags.Ephemeral,
		});
		return true;
	}
	if (consumed.status !== 'ok') {
		await interaction.reply({
			content: t(locale, 'rpg.delete.expired'),
			flags: MessageFlags.Ephemeral,
		});
		return true;
	}

	const { session } = consumed;
	if (
		interaction.fields.getTextInputValue('character-key-confirmation')
		!== session.characterKey
	) {
		await interaction.reply({
			content: t(locale, 'rpg.delete.incorrectConfirmation', {
				key: session.characterKey,
			}),
			flags: MessageFlags.Ephemeral,
		});
		return true;
	}

	try {
		await deleteCharacter(
			session.characterKey,
			currentCharacter => canManageCharacter(interaction, currentCharacter, config),
		);
		await interaction.reply(
			createCharacterDeletedResponse(session.characterKey, locale),
		);
	}
	catch (error) {
		if (!await replyToCharacterError(interaction, error, locale)) {
			throw error;
		}
	}
	return true;
}

function createFieldModal(sessionId, fieldName, value, locale = 'en') {
	const field = getEditableFieldDefinition(fieldName);
	if (!field) {
		throw new Error(`Unknown editable field: ${fieldName}`);
	}
	const label = getEditFieldLabel(fieldName, locale);
	const targets = getEditTargetDefinitions(fieldName);
	const inputDefinitions = field.editKind === 'multi'
		? targets.map(target => ({
			customId: getEditInputId(target.id),
			label: getEditInputLabel(target, locale),
			target,
			value: value[target.id],
		}))
		: [{
			customId: 'field-value',
			label,
			target: field,
			value,
		}];
	const components = inputDefinitions.map(inputDefinition => (
		createEditInput(field, inputDefinition, locale)
	));

	return new ModalBuilder()
		.setCustomId(`rpg-set:${sessionId}`)
		.setTitle(t(locale, 'rpg.editor.title', { field: label }).slice(0, 45))
		.addLabelComponents(...components);
}

function getEditInputLabel(target, locale) {
	const labelKey = {
		appearance: 'appearance',
		backstory: 'backstory',
		firstName: 'firstName',
		goals: 'goals',
		lastName: 'lastName',
		'personality.description': 'description',
		'personality.traits': 'traits',
		'race.lore': 'lore',
		'race.name': 'name',
		'race.physicalDescription': 'physicalDescription',
		'racialTraits.physicalAbility': 'physicalAbility',
		'racialTraits.skillBonus': 'skillBonus',
	}[target.id];
	const numericLabelKey = target.id.endsWith('.current')
		? 'current'
		: target.id.endsWith('.max')
			? 'maximum'
			: null;
	return labelKey
		? t(locale, `rpg.editor.inputLabels.${labelKey}`)
		: numericLabelKey
			? t(locale, `rpg.editor.inputLabels.${numericLabelKey}`)
			: getCharacterFieldLabel(locale, target.id);
}

function createEditInput(field, inputDefinition, locale) {
	const { customId, label, target, value } = inputDefinition;
	const inputStyle = (
		field.editKind === 'named-lines'
		|| target.paragraph
		|| target.multiline
	)
		? TextInputStyle.Paragraph
		: TextInputStyle.Short;
	const input = new TextInputBuilder()
		.setCustomId(customId)
		.setStyle(inputStyle)
		.setMaxLength(4_000)
		.setRequired(isEditInputRequired(field, target));
	if (value) {
		input.setValue(value);
	}
	else {
		input.setPlaceholder(getEditInputPlaceholder(field, target, locale).slice(0, 100));
	}
	return new LabelBuilder()
		.setLabel(label.slice(0, 45))
		.setDescription(getEditInputDescription(field, target, locale).slice(0, 100))
		.setTextInputComponent(input);
}

function getEditInputDescription(field, target, locale) {
	if (field.editKind === 'named-lines') {
		return t(locale, 'rpg.editor.statisticsDescription');
	}
	if (target.rules) {
		return t(locale, 'rpg.editor.rulesDescription');
	}
	if (target.multiline) {
		return t(locale, 'rpg.editor.collectionDescription');
	}
	if (target.type === 'text') {
		return t(locale, 'rpg.editor.textDescription');
	}
	return t(locale, 'rpg.editor.numberDescription');
}

function getEditInputPlaceholder(field, target, locale) {
	if (field.editKind === 'named-lines') {
		return t(locale, 'rpg.editor.statisticsPlaceholder');
	}
	if (target.multiline) {
		return t(locale, 'rpg.editor.collectionPlaceholder');
	}
	return t(locale, 'rpg.editor.valuePlaceholder');
}

function isEditInputRequired(field, target) {
	if (field.editKind === 'named-lines') {
		return true;
	}
	return target.type !== 'text';
}

function createDeletionModal(sessionId, characterKey, locale = 'en') {
	const confirmationInput = new TextInputBuilder()
		.setCustomId('character-key-confirmation')
		.setStyle(TextInputStyle.Short)
		.setMinLength(1)
		.setMaxLength(50)
		.setPlaceholder(t(locale, 'rpg.delete.confirmationPlaceholder'))
		.setRequired(true);

	return new ModalBuilder()
		.setCustomId(`rpg-delete:${sessionId}`)
		.setTitle(t(locale, 'rpg.delete.modalTitle'))
		.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				t(locale, 'rpg.delete.warning', { key: characterKey }),
			),
		)
		.addLabelComponents(
			new LabelBuilder()
				.setLabel(t(locale, 'rpg.delete.confirmationLabel'))
				.setDescription(t(locale, 'rpg.delete.confirmationDescription'))
				.setTextInputComponent(confirmationInput),
		);
}

function findEditableField(fieldName) {
	return getEditableFieldDefinition(fieldName)?.editId ?? null;
}

function getSubmittedFieldValue(interaction, fieldName) {
	const field = getEditableFieldDefinition(fieldName);
	if (field?.editKind !== 'multi') {
		return interaction.fields.getTextInputValue('field-value');
	}
	return Object.fromEntries(getEditTargetDefinitions(fieldName).map(target => [
		target.id,
		interaction.fields.getTextInputValue(getEditInputId(target.id)),
	]));
}

function isValueTooLarge(value) {
	const values = value && typeof value === 'object'
		? Object.values(value)
		: [value];
	return values.some(item => String(item).length > 4_000);
}

module.exports = {
	createDeletionModal,
	createFieldModal,
	handleRpgInteraction,
	openCharacterDeletionConfirmation,
	openCharacterEditor,
};

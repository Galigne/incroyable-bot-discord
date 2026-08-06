const {
	LabelBuilder,
	MessageFlags,
	ModalBuilder,
	TextDisplayBuilder,
	TextInputBuilder,
	TextInputStyle,
} = require('discord.js');
const {
	deleteEntity,
	getDeletableEntity,
	getEditableEntityField,
	updateEditableEntity,
} = require('../../services/entityApplicationService');
const {
	getEditableEntityFieldDefinition,
} = require('../../services/entityFieldCatalog');
const { canManageEntity } = require('../../util/authorization');
const {
	createEntityDeletedResponse,
	createEntityEditResponse,
} = require('../../util/entityCommandResponses');
const { replyToEntityError } = require('../../util/entityCommandErrors');
const {
	getResourceAbbreviation,
} = require('../../util/characterDisplay');
const { getEntityFieldLabel } = require('../../util/entityDisplay');
const {
	createEntityHistoryContext,
} = require('../../util/entityHistoryContext');
const {
	consumeInteractionSession,
	createInteractionSession,
	deleteInteractionSession,
	getInteractionSession,
} = require('../../util/interactionSessions');
const {
	getEntityEditFieldLabel,
	getEntityEditInputId,
	getEntityEditTargetDefinitions,
} = require('../entity/editorFields');
const { getLocale, t } = require('../../util/i18n');

async function openEntityEditor(interaction, config, entityKey, fieldName) {
	const locale = getLocale(config, interaction.guildId);
	try {
		const editorState = await getEditableEntityField(
			entityKey,
			fieldName,
			entity => canManageEntity(interaction, entity, config),
		);
		const type = editorState.entity.type;
		const normalizedField = getEditableEntityFieldDefinition(type, fieldName)?.editId;
		if (!normalizedField) {
			await interaction.reply({
				content: t(locale, 'rpg.editor.unknownField', { field: fieldName }),
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		if (isValueTooLarge(editorState.value)) {
			await interaction.reply({
				content: t(locale, 'rpg.editor.tooLarge'),
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const session = createInteractionSession('set', interaction.user.id, {
			entityKey,
			entityType: type,
			fieldName: normalizedField,
		});
		await interaction.showModal(createEntityFieldModal(
			session.id,
			type,
			normalizedField,
			editorState.value,
			locale,
		));
	}
	catch (error) {
		if (!await replyToEntityError(interaction, error, locale)) {
			throw error;
		}
	}
}

async function openEntityDeletionConfirmation(
	interaction,
	config,
	entityKey,
	options = {},
) {
	const locale = getLocale(config, interaction.guildId);
	try {
		const entity = await getDeletableEntity(
			entityKey,
			currentEntity => canManageEntity(interaction, currentEntity, config),
		);
		const confirmationInputId = options.legacy
			? 'character-key-confirmation'
			: 'entity-key-confirmation';
		const session = createInteractionSession('delete', interaction.user.id, {
			confirmationInputId,
			entityKey,
			entityType: entity.type,
		});
		await interaction.showModal(createEntityDeletionModal(
			session.id,
			entityKey,
			locale,
			confirmationInputId,
		));
	}
	catch (error) {
		if (!await replyToEntityError(interaction, error, locale)) {
			throw error;
		}
	}
}

async function handleEntityInteraction(interaction, config) {
	if (!interaction.isModalSubmit()) {
		return false;
	}
	if (interaction.customId.startsWith('rpg-set:')) {
		return handleEntityEditSubmission(interaction, config);
	}
	if (interaction.customId.startsWith('rpg-delete:')) {
		return handleEntityDeletionSubmission(interaction, config);
	}
	return false;
}

async function handleEntityEditSubmission(interaction, config) {
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
		const result = await updateEditableEntity(
			session.entityKey,
			session.fieldName,
			getSubmittedFieldValue(
				interaction,
				session.entityType,
				session.fieldName,
			),
			entity => canManageEntity(interaction, entity, config),
			createEntityHistoryContext(interaction, config),
			session.entityType,
		);
		deleteInteractionSession(session.id);
		await interaction.reply(createEntityEditResponse(result, locale));
	}
	catch (error) {
		if (!await replyToEntityError(interaction, error, locale)) {
			throw error;
		}
	}
	return true;
}

async function handleEntityDeletionSubmission(interaction, config) {
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
		interaction.fields.getTextInputValue(session.confirmationInputId)
		!== session.entityKey
	) {
		await interaction.reply({
			content: t(locale, 'rpg.delete.incorrectConfirmation', {
				key: session.entityKey,
			}),
			flags: MessageFlags.Ephemeral,
		});
		return true;
	}

	try {
		await deleteEntity(
			session.entityKey,
			entity => canManageEntity(interaction, entity, config),
			session.entityType,
		);
		await interaction.reply(createEntityDeletedResponse(session.entityKey, locale));
	}
	catch (error) {
		if (!await replyToEntityError(interaction, error, locale)) {
			throw error;
		}
	}
	return true;
}

function createEntityFieldModal(
	sessionId,
	type,
	fieldName,
	value,
	locale = 'en',
) {
	const field = getEditableEntityFieldDefinition(type, fieldName);
	if (!field) {
		throw new Error(`Unknown editable ${type} field: ${fieldName}`);
	}
	const fieldLabel = getEntityEditFieldLabel(type, fieldName, locale);
	const targets = getEntityEditTargetDefinitions(type, fieldName);
	const inputDefinitions = field.editKind === 'multi'
		? targets.map(target => ({
			customId: getEntityEditInputId(target.id),
			label: getEditInputLabel(type, target, locale),
			target,
			value: value[target.id],
		}))
		: [{
			customId: 'field-value',
			label: fieldLabel,
			target: field,
			value,
		}];
	return new ModalBuilder()
		.setCustomId(`rpg-set:${sessionId}`)
		.setTitle(t(locale, 'rpg.editor.title', { field: fieldLabel }).slice(0, 45))
		.addLabelComponents(...inputDefinitions.map(inputDefinition => (
			createEditInput(type, field, inputDefinition, locale)
		)));
}

function getEditInputLabel(type, target, locale) {
	if (target.resourceId && target.inputKind === 'pair') {
		return getResourceAbbreviation(locale, target.resourceId);
	}
	const labelKey = {
		'background.appearance': 'appearance',
		'background.backstory': 'backstory',
		'background.goals': 'goals',
		'name.firstName': 'firstName',
		'name.lastName': 'lastName',
		'personality.description': 'description',
		'personality.traits': 'traits',
		'race.lore': 'lore',
		'race.name': 'name',
		'race.physicalDescription': 'physicalDescription',
		'race.traits.physicalAbility': 'physicalAbility',
		'race.traits.skillBonus': 'skillBonus',
	}[target.id];
	return labelKey
		? t(locale, `rpg.editor.inputLabels.${labelKey}`)
		: getEntityFieldLabel(locale, type, target.id);
}

function createEditInput(type, field, inputDefinition, locale) {
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
		.setMaxLength(target.inputKind === 'pair'
			? 100
			: target.maxLength ?? 4_000)
		.setRequired(isEditInputRequired(field, target));
	if (value) {
		input.setValue(value);
	}
	else {
		input.setPlaceholder(getEditInputPlaceholder(field, target, locale).slice(0, 100));
	}
	return new LabelBuilder()
		.setLabel(label.slice(0, 45))
		.setDescription(getEditInputDescription(type, field, target, locale).slice(0, 100))
		.setTextInputComponent(input);
}

function getEditInputDescription(type, field, target, locale) {
	if (target.inputKind === 'pair') {
		return t(locale, 'rpg.editor.pairDescription');
	}
	if (field.editKind === 'named-lines') {
		return t(locale, 'rpg.editor.statisticsDescription');
	}
	if (target.rules) {
		return t(locale, 'rpg.editor.rulesDescription');
	}
	if (target.described) {
		return t(locale, 'rpg.editor.describedDescription');
	}
	if (target.id === 'gear.equipment') {
		return t(locale, 'rpg.editor.equipmentDescription');
	}
	if (target.id === 'gear.inventory') {
		return t(locale, 'rpg.editor.inventoryDescription');
	}
	if (target.multiline) {
		return t(locale, 'rpg.editor.collectionDescription');
	}
	if (target.type === 'text') {
		return t(locale, 'rpg.editor.textDescription');
	}
	return t(locale, 'rpg.editor.numberDescription', {
		field: getEntityFieldLabel(locale, type, target.id),
	});
}

function getEditInputPlaceholder(field, target, locale) {
	if (target.inputKind === 'pair') {
		return t(locale, 'rpg.editor.pairPlaceholder');
	}
	if (field.editKind === 'named-lines') {
		return t(locale, 'rpg.editor.statisticsPlaceholder');
	}
	if (target.described) {
		return t(locale, 'rpg.editor.describedPlaceholder');
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
	return target.inputKind === 'pair' || target.type !== 'text';
}

function createEntityDeletionModal(
	sessionId,
	entityKey,
	locale = 'en',
	confirmationInputId = 'entity-key-confirmation',
) {
	const confirmationInput = new TextInputBuilder()
		.setCustomId(confirmationInputId)
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
				t(locale, 'rpg.delete.warning', { key: entityKey }),
			),
		)
		.addLabelComponents(
			new LabelBuilder()
				.setLabel(t(locale, 'rpg.delete.confirmationLabel'))
				.setDescription(t(locale, 'rpg.delete.confirmationDescription'))
				.setTextInputComponent(confirmationInput),
		);
}

function getSubmittedFieldValue(interaction, type, fieldName) {
	const field = getEditableEntityFieldDefinition(type, fieldName);
	if (field?.editKind !== 'multi') {
		return interaction.fields.getTextInputValue('field-value');
	}
	return Object.fromEntries(
		getEntityEditTargetDefinitions(type, fieldName).map(target => [
			target.id,
			interaction.fields.getTextInputValue(getEntityEditInputId(target.id)),
		]),
	);
}

function isValueTooLarge(value) {
	const values = value && typeof value === 'object'
		? Object.values(value)
		: [value];
	return values.some(item => String(item).length > 4_000);
}

function createFieldModal(sessionId, fieldName, value, locale = 'en') {
	return createEntityFieldModal(sessionId, 'character', fieldName, value, locale);
}

function createDeletionModal(sessionId, entityKey, locale = 'en') {
	return createEntityDeletionModal(
		sessionId,
		entityKey,
		locale,
		'character-key-confirmation',
	);
}

function openCharacterEditor(interaction, config, characterKey, fieldName) {
	return openEntityEditor(interaction, config, characterKey, fieldName);
}

function openCharacterDeletionConfirmation(interaction, config, characterKey) {
	return openEntityDeletionConfirmation(
		interaction,
		config,
		characterKey,
		{ legacy: true },
	);
}

module.exports = {
	createDeletionModal,
	createEntityDeletionModal,
	createEntityFieldModal,
	createFieldModal,
	handleCharacterInteraction: handleEntityInteraction,
	handleEntityInteraction,
	openCharacterDeletionConfirmation,
	openCharacterEditor,
	openEntityDeletionConfirmation,
	openEntityEditor,
};

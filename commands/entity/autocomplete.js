const {
	getEditableEntityFields,
	getViewableEntityFields,
} = require('../../services/entityFieldCatalog');
const {
	getEntity,
	listEntities,
	listUndoableEntities,
} = require('../../services/entityApplicationService');
const { filterAutocompleteChoices } = require('../../util/autocomplete');
const { getEntityFieldLabel } = require('../../util/entityDisplay');
const { t } = require('../../util/i18n');

async function getEntityChoices(focusedValue, locale = 'en', options = {}) {
	const entities = await listEntities();
	const filteredEntities = options.filterEntity
		? entities.filter(options.filterEntity)
		: entities;
	return filterAutocompleteChoices(
		filteredEntities.map(entity => createEntityChoice(entity, locale)),
		focusedValue,
	);
}

async function getUndoableEntityChoices(focusedValue, locale, canManage) {
	const entities = await listUndoableEntities(canManage);
	return filterAutocompleteChoices(
		entities.map(entity => createEntityChoice(entity, locale)),
		focusedValue,
	);
}

async function getEntitySectionChoices(
	focusedValue,
	locale,
	entityKey,
	{
		canManage = () => true,
		hasFullAuthority = () => false,
		includeAll = false,
		mode = 'set',
	} = {},
) {
	try {
		const entity = entityKey ? await getEntity(entityKey) : null;
		if (!entity || !canManage(entity)) {
			return [];
		}
		const fields = mode === 'get'
			? getViewableEntityFields(entity.type)
			: getEditableEntityFields(entity.type).filter(field => (
				field.id !== 'settings' || hasFullAuthority(entity)
			));
		const choices = createSectionChoices(entity.type, fields, locale);
		if (includeAll) {
			choices.unshift({
				name: `${t(locale, 'rpg.get.allField')} (all)`,
				value: 'all',
			});
		}
		return filterAutocompleteChoices(choices, focusedValue);
	}
	catch (error) {
		if (!['ENOENT', 'INVALID_ENTITY_KEY'].includes(error.code)) {
			throw error;
		}
		return [];
	}
}

function createSectionChoices(type, sections, locale) {
	return sections.map(section => {
		const sectionLabel = getEntityFieldLabel(locale, type, section.id);
		return {
			name: `${sectionLabel} (${section.sectionId})`,
			value: section.sectionId ?? section.editId ?? section.viewId,
		};
	});
}

function createEntityChoice(entity, locale) {
	const display = entity.displayName === entity.key
		? entity.key
		: `${entity.displayName} (${entity.key})`;
	return {
		name: `${display} - ${t(locale, `entity.types.${entity.type}`)}`.slice(0, 100),
		value: entity.key,
	};
}

module.exports = {
	getEntityChoices,
	getEntitySectionChoices,
	getUndoableEntityChoices,
};

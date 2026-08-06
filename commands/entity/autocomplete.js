const {
	getAllEntitySections,
	getEntitySections,
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
	const filteredEntities = options.creatorId
		? entities.filter(entity => entity.creatorId === options.creatorId)
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

async function getEntitySectionChoices(focusedValue, locale, entityKey) {
	let choices;
	try {
		const entity = entityKey ? await getEntity(entityKey) : null;
		choices = entity
			? createSectionChoices(entity.type, getEntitySections(entity.type), locale)
			: createAllSectionChoices(locale);
	}
	catch (error) {
		if (!['ENOENT', 'INVALID_ENTITY_KEY'].includes(error.code)) {
			throw error;
		}
		choices = createAllSectionChoices(locale);
	}
	return filterAutocompleteChoices(choices, focusedValue);
}

function createAllSectionChoices(locale) {
	const catalogs = getAllEntitySections();
	return [
		...createSectionChoices('character', catalogs.character, locale),
		...createSectionChoices('creature', catalogs.creature, locale),
	].filter((choice, index, all) => (
		all.findIndex(candidate => candidate.value === choice.value) === index
	));
}

function createSectionChoices(type, sections, locale) {
	return sections.map(section => {
		const sectionLabel = getEntityFieldLabel(locale, type, section.id);
		return {
			name: `${sectionLabel} (${section.sectionId})`,
			value: section.sectionId,
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

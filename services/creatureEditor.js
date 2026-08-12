const { createFieldEditor } = require('./entityFieldEditor');
const {
	getCreatureFieldDefinition,
	getEditableCreatureFieldDefinition,
} = require('./creatureFieldCatalog');
const { MAX_AP } = require('./mechanics/constants');

const editor = createFieldEditor({
	createEditError: creatureEditError,
	getEditableFieldDefinition: getEditableCreatureFieldDefinition,
	getFieldDefinition: getCreatureFieldDefinition,
	validateUpdates: validateCreatureUpdates,
});

function validateCreatureUpdates(creature, updates, editError) {
	const proposed = structuredClone(creature);
	for (const update of updates) {
		const parent = update.target.path
			.slice(0, -1)
			.reduce((target, key) => target[key], proposed);
		parent[update.target.path.at(-1)] = update.value;
	}

	if (!Number.isInteger(proposed.level) || proposed.level < 1 || proposed.level > 10) {
		throw editError('errors.creatureLevelRange');
	}
	for (const [statId, value] of Object.entries(proposed.statistics)) {
		if (!Number.isFinite(value) || value < 0 || value > 100) {
			throw editError('errors.creatureStatisticRange', { stat: statId });
		}
	}
	for (const resourceId of ['hp', 'ar', 'ap', 'md']) {
		validateResourcePair(proposed.resources[resourceId], resourceId, editError);
	}
	validateResourcePair(proposed.gear.encumbrance, 'encumbrance', editError);
}

function validateResourcePair(resource, resourceId, editError) {
	const maxAllowed = resourceId === 'ap' ? MAX_AP : Number.MAX_SAFE_INTEGER;
	if (
		!Number.isFinite(resource.current)
		|| !Number.isFinite(resource.max)
		|| resource.current < 0
		|| resource.max < 0
		|| resource.current > resource.max
		|| resource.max > maxAllowed
		|| (
			resourceId === 'ap'
			&& (!Number.isInteger(resource.current) || !Number.isInteger(resource.max))
		)
	) {
		throw editError('errors.creatureResourceRange', { resource: resourceId });
	}
}

function creatureEditError(translationKey, translationVariables = {}) {
	const error = new Error(translationKey);
	error.code = 'INVALID_CREATURE_EDIT';
	error.translationKey = translationKey;
	error.translationVariables = translationVariables;
	return error;
}

module.exports = editor;

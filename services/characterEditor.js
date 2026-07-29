const {
	characterEditError,
	validateActionPointPair,
} = require('./mechanics/characterValidation');
const {
	getCharacterFieldDefinition,
	getEditableFieldDefinition,
} = require('./characterFieldCatalog');

function getEditableFieldValue(character, fieldName) {
	const field = requireEditableField(fieldName);
	const targets = getEditTargets(field);
	if (field.editKind === 'multi') {
		return Object.fromEntries(targets.map(target => [
			target.id,
			serializeTargetValue(character, target),
		]));
	}
	if (field.editKind === 'colon') {
		return targets
			.map(target => serializeTargetValue(character, target))
			.join(':');
	}
	return serializeTargetValue(character, targets[0]);
}

function setEditableFieldValue(character, fieldName, submittedValue) {
	const field = requireEditableField(fieldName);
	const targets = getEditTargets(field);
	const updates = parseSubmittedValue(field, targets, submittedValue);
	validatePlannedUpdates(character, updates);
	for (const update of updates) {
		setAtPath(character, update.target.path, update.value);
	}
	return {
		translationKey: field.editKind === 'multiline'
			? 'editorResults.collectionUpdated'
			: 'editorResults.updated',
		translationVariables: { fieldId: field.id },
	};
}

function parseSubmittedValue(field, targets, submittedValue) {
	if (field.editKind === 'multi') {
		if (
			!submittedValue
			|| typeof submittedValue !== 'object'
			|| Array.isArray(submittedValue)
		) {
			throw editError('errors.groupInputMissing', { fieldId: field.id });
		}
		return targets.map(target => {
			if (typeof submittedValue[target.id] !== 'string') {
				throw editError('errors.groupInputMissing', {
					componentFieldId: target.id,
					fieldId: field.id,
				});
			}
			return {
				target,
				value: parseTargetValue(target, submittedValue[target.id]),
			};
		});
	}

	if (typeof submittedValue !== 'string') {
		throw editError('errors.valueRequired', { fieldId: field.id });
	}
	if (field.editKind === 'colon') {
		const components = submittedValue.split(':').map(value => value.trim());
		if (components.length !== targets.length) {
			throw editError('errors.colonValueCount', {
				count: targets.length,
				fieldId: field.id,
				formatFieldIds: field.editTargetIds,
			});
		}
		return targets.map((target, index) => {
			if (target.type === 'number' && !components[index]) {
				throw editError('errors.colonValueRequired', {
					fieldId: field.id,
					formatFieldIds: field.editTargetIds,
				});
			}
			return {
				target,
				value: parseTargetValue(target, components[index]),
			};
		});
	}

	return [{
		target: targets[0],
		value: parseTargetValue(targets[0], submittedValue),
	}];
}

function parseTargetValue(target, submittedValue) {
	if (target.multiline) {
		return parseMultilineValue(target, submittedValue);
	}

	const trimmedValue = submittedValue.trim();
	if (target.type === 'number') {
		const numberValue = Number(trimmedValue);
		if (!trimmedValue || !Number.isFinite(numberValue)) {
			throw editError('errors.mustBeNumber', { fieldId: target.id });
		}
		return numberValue;
	}
	return trimmedValue.toLowerCase() === 'clear' ? '' : trimmedValue;
}

function parseMultilineValue(field, submittedValue) {
	const lines = submittedValue
		.split(/\r?\n/)
		.map(line => line.trim().replace(/^[-*]\s+/, ''))
		.filter(Boolean);
	return lines.map(line => parseMultilineEntry(field, line));
}

function parseMultilineEntry(field, line) {
	if (!field.rules) {
		return line;
	}

	const firstSeparator = line.indexOf(':');
	const secondSeparator = firstSeparator === -1
		? -1
		: line.indexOf(':', firstSeparator + 1);
	const name = (firstSeparator === -1 ? line : line.slice(0, firstSeparator)).trim();
	if (!name) {
		throw editError('errors.ruleNameRequired');
	}
	const possibleLevel = secondSeparator === -1
		? ''
		: line.slice(firstSeparator + 1, secondSeparator).trim();
	const level = Number(possibleLevel);
	if (!Number.isSafeInteger(level) || level < 1) {
		throw editError('errors.ruleLevelInvalid');
	}
	const description = line.slice(secondSeparator + 1).trim();
	return { name, description, level };
}

function validatePlannedUpdates(character, updates) {
	const actionPointUpdates = updates.filter(update => (
		update.target.path[0] === 'resources'
		&& update.target.path[1] === 'ap'
	));
	if (actionPointUpdates.length === 0) {
		return;
	}
	const proposed = {
		...character.resources.ap,
		...Object.fromEntries(actionPointUpdates.map(update => [
			update.target.path[2],
			update.value,
		])),
	};
	validateActionPointPair(proposed.current, proposed.max);
}

function serializeTargetValue(character, target) {
	const value = getAtPath(character, target.path);
	if (target.multiline) {
		return value
			.map(item => target.rules
				? `${item.name}: ${item.level}: ${item.description}`
				: item)
			.join('\n');
	}
	return String(value ?? '');
}

function getEditTargets(field) {
	return field.editTargetIds.map(targetId => {
		const target = getCharacterFieldDefinition(targetId);
		if (!target?.path || !target.type) {
			throw new Error(`Editable target is not stored: ${targetId}`);
		}
		return target;
	});
}

function requireEditableField(fieldName) {
	const field = getEditableFieldDefinition(fieldName);
	if (!field) {
		throw editError('errors.unknownEditField', { field: fieldName });
	}
	return field;
}

function normalizeFieldName(value = '') {
	return getEditableFieldDefinition(value)?.editId
		?? value.toLowerCase().replace(/[^a-z]/g, '');
}

function getAtPath(object, path) {
	return path.reduce((value, key) => value[key], object);
}

function setAtPath(object, path, value) {
	const parent = path.slice(0, -1).reduce((target, key) => target[key], object);
	parent[path.at(-1)] = value;
}

function editError(translationKey, translationVariables) {
	return characterEditError(translationKey, translationVariables);
}

module.exports = {
	getEditableFieldValue,
	normalizeFieldName,
	setEditableFieldValue,
};

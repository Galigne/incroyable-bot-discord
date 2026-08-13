function createFieldEditor({
	createEditError,
	getEditableFieldDefinition,
	getFieldDefinition,
	validateUpdates = () => undefined,
}) {
	function getEditableFieldValue(entity, fieldName) {
		const field = requireEditableField(fieldName);
		const inputs = getEditInputs(field);
		if (field.editKind === 'multi') {
			return Object.fromEntries(inputs.map(input => [
				input.id,
				serializeInputValue(entity, input),
			]));
		}
		if (field.editKind === 'named-lines') {
			return inputs
				.map(target => `${getNamedLineKey(target)}: ${serializeTargetValue(
					entity,
					target,
				)}`)
				.join('\n');
		}
		return serializeInputValue(entity, inputs[0]);
	}

	function setEditableFieldValue(entity, fieldName, submittedValue) {
		const field = requireEditableField(fieldName);
		const inputs = getEditInputs(field);
		const updates = parseSubmittedValue(field, inputs, submittedValue);
		validateUpdates(entity, updates, editError);
		for (const update of updates) {
			setAtPath(entity, update.target.path, update.value);
		}
		return {
			translationKey: field.editKind === 'multiline'
				? 'editorResults.collectionUpdated'
				: 'editorResults.updated',
			translationVariables: { fieldId: field.id },
		};
	}

	function parseSubmittedValue(field, inputs, submittedValue) {
		if (field.editKind === 'multi') {
			if (
				!submittedValue
				|| typeof submittedValue !== 'object'
				|| Array.isArray(submittedValue)
			) {
				throw editError('errors.groupInputMissing', { fieldId: field.id });
			}
			return inputs.flatMap(input => {
				const inputValue = getSubmittedInputValue(submittedValue, input);
				if (typeof inputValue !== 'string') {
					throw editError('errors.groupInputMissing', {
						componentFieldId: input.id,
						fieldId: field.id,
					});
				}
				return parseInputValue(input, inputValue);
			});
		}

		if (typeof submittedValue !== 'string') {
			throw editError('errors.valueRequired', { fieldId: field.id });
		}
		if (field.editKind === 'named-lines') {
			return parseNamedLineValue(field, inputs, submittedValue);
		}
		return parseInputValue(inputs[0], submittedValue);
	}

	function getSubmittedInputValue(submittedValue, input) {
		for (const inputId of [input.id, ...(input.aliases ?? [])]) {
			if (Object.hasOwn(submittedValue, inputId)) {
				return submittedValue[inputId];
			}
		}
		return undefined;
	}

	function parseInputValue(input, submittedValue) {
		if (input.inputKind === 'pair') {
			return parsePairValue(input, submittedValue);
		}
		return [{ target: input, value: parseTargetValue(input, submittedValue) }];
	}

	function parsePairValue(input, submittedValue) {
		const parts = submittedValue.trim().split(':');
		if (parts.length !== 2 || parts.some(part => !part.trim())) {
			throw editError('errors.pairFormat', { fieldId: input.id });
		}
		return getPairTargets(input).map((target, index) => ({
			target,
			value: parseTargetValue(target, parts[index]),
		}));
	}

	function parseNamedLineValue(field, targets, submittedValue) {
		const targetsByName = new Map(targets.map(target => [
			getNamedLineKey(target),
			target,
		]));
		const valuesByTargetId = new Map();
		const lines = submittedValue
			.split(/\r?\n/)
			.map(value => value.trim())
			.filter(Boolean);
		for (const line of lines) {
			const separatorIndex = line.indexOf(':');
			if (separatorIndex === -1) {
				throw editError('errors.statisticsLineInvalid');
			}
			const name = line.slice(0, separatorIndex).trim().toLowerCase();
			const target = targetsByName.get(name);
			if (!target) {
				throw editError('errors.statisticsNameUnknown', {
					stat: name,
					statistics: [...targetsByName.keys()].join(', '),
				});
			}
			if (valuesByTargetId.has(target.id)) {
				throw editError('errors.statisticsDuplicate', { stat: name });
			}
			valuesByTargetId.set(
				target.id,
				parseTargetValue(target, line.slice(separatorIndex + 1)),
			);
		}
		const missingTarget = targets.find(target => !valuesByTargetId.has(target.id));
		if (missingTarget) {
			throw editError('errors.statisticsMissing', {
				stat: getNamedLineKey(missingTarget),
			});
		}
		return targets.map(target => ({
			target,
			value: valuesByTargetId.get(target.id),
		}));
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
		return submittedValue
			.split(/\r?\n/)
			.map(line => line.trim())
			.filter(Boolean)
			.map(line => parseMultilineEntry(field, line));
	}

	function parseMultilineEntry(field, line) {
		if (field.described) {
			const separator = line.indexOf(':');
			const name = (separator === -1 ? line : line.slice(0, separator)).trim();
			const description = separator === -1 ? '' : line.slice(separator + 1).trim();
			if (!name || !description) {
				throw editError('errors.describedEntryInvalid');
			}
			return { name, description };
		}
		if (!field.rules) {
			return line;
		}

		const firstSeparator = line.indexOf(':');
		const secondSeparator = firstSeparator === -1
			? -1
			: line.indexOf(':', firstSeparator + 1);
		const name = (firstSeparator === -1
			? line
			: line.slice(0, firstSeparator)).trim();
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
		if (!description) {
			throw editError('errors.ruleDescriptionRequired');
		}
		return { name, description, level };
	}

	function serializeTargetValue(entity, target) {
		const value = getAtPath(entity, target.path);
		if (target.multiline) {
			return value.map(item => {
				if (target.rules) {
					return `${item.name}:${item.level}:${item.description}`;
				}
				if (target.described) {
					return `${item.name}:${item.description}`;
				}
				return item;
			}).join('\n');
		}
		return String(value ?? '');
	}

	function serializeInputValue(entity, input) {
		if (input.inputKind === 'pair') {
			return getPairTargets(input)
				.map(target => serializeTargetValue(entity, target))
				.join(':');
		}
		return serializeTargetValue(entity, input);
	}

	function getNamedLineKey(target) {
		return target.id.startsWith('statistics.')
			? target.id.slice('statistics.'.length)
			: target.id;
	}

	function getEditInputs(field) {
		return field.editInputIds.map(inputId => {
			const input = getFieldDefinition(inputId);
			if (!input || (!input.inputKind && (!input.path || !input.type))) {
				throw new Error(`Editable input is not configured: ${inputId}`);
			}
			return input;
		});
	}

	function getPairTargets(input) {
		return input.inputTargetIds.map(targetId => {
			const target = getFieldDefinition(targetId);
			if (!target?.path || !target.type) {
				throw new Error(`Pair target is not stored: ${targetId}`);
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

	function editError(translationKey, translationVariables) {
		return createEditError(translationKey, translationVariables);
	}

	return {
		getEditableFieldValue,
		normalizeFieldName,
		setEditableFieldValue,
	};
}

function getAtPath(object, path) {
	return path.reduce((value, key) => value[key], object);
}

function setAtPath(object, path, value) {
	const parent = path.slice(0, -1).reduce((target, key) => target[key], object);
	parent[path.at(-1)] = value;
}

module.exports = { createFieldEditor };

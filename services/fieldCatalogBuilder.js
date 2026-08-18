function createFieldCatalogBuilder({ catalogName, sectionIds }) {
	if (typeof catalogName !== 'string' || catalogName.length === 0) {
		throw new TypeError('Field catalog name must be a non-empty string.');
	}
	if (!Array.isArray(sectionIds)) {
		throw new TypeError(`${catalogName} field catalog sections must be an array.`);
	}

	const orderedSectionIds = Object.freeze([...sectionIds]);
	const sectionIdSet = new Set(orderedSectionIds);
	if (sectionIdSet.size !== orderedSectionIds.length) {
		throw new Error(`Duplicate ${catalogName} section ID.`);
	}

	const definitions = [];
	const definitionsById = new Map();
	const aliases = new Map();
	let built = false;

	function addField(id, labelKey, options = {}) {
		assertMutable();
		if (definitionsById.has(id)) {
			throw new Error(`Duplicate ${catalogName} field: ${id}`);
		}

		const definitionOptions = { ...options };
		if (options.aliases) {
			definitionOptions.aliases = Object.freeze([...options.aliases]);
		}
		const definition = Object.freeze({
			id,
			...(labelKey ? { labelKey } : {}),
			...definitionOptions,
		});
		const definitionAliases = [id, ...(definition.aliases ?? [])];
		for (const alias of definitionAliases) {
			assertAliasAvailable(alias, definition);
		}

		definitions.push(definition);
		definitionsById.set(id, definition);
		for (const alias of definitionAliases) {
			registerAlias(alias, definition);
		}
		return definition;
	}

	function addSection(id, labelKey, editKind, editInputIds, options = {}) {
		assertMutable();
		if (!sectionIdSet.has(id)) {
			throw new Error(`Unknown ${catalogName} section: ${id}`);
		}
		const viewTargetIds = options.viewTargetIds ?? editInputIds;
		return addField(id, labelKey, {
			...options,
			editId: id,
			editInputIds: Object.freeze([...editInputIds]),
			editKind,
			sectionId: id,
			sectionOrder: orderedSectionIds.indexOf(id),
			viewId: id,
			viewTargetIds: Object.freeze([...viewTargetIds]),
		});
	}

	function build() {
		assertMutable();
		const sections = orderedSectionIds.map(id => {
			const definition = definitionsById.get(id);
			if (definition?.sectionId !== id) {
				throw new Error(`Missing ${catalogName} section: ${id}`);
			}
			return definition;
		});
		const immutableDefinitions = Object.freeze([...definitions]);
		const immutableSections = Object.freeze(sections);
		const editableFields = Object.freeze(
			sections.filter(definition => definition.editId),
		);
		const viewableFields = Object.freeze(
			sections.filter(definition => definition.viewId),
		);
		built = true;

		return Object.freeze({
			definitions: immutableDefinitions,
			getEditableFieldDefinition: fieldId => (
				getCapableFieldDefinition(fieldId, 'editId')
			),
			getEditableFields: () => editableFields,
			getFieldDefinition,
			getSections: () => immutableSections,
			getViewableFieldDefinition: fieldId => (
				getCapableFieldDefinition(fieldId, 'viewId')
			),
			getViewableFields: () => viewableFields,
			sectionIds: orderedSectionIds,
		});
	}

	function getFieldDefinition(fieldId) {
		if (typeof fieldId !== 'string') {
			return null;
		}
		return definitionsById.get(fieldId)
			?? aliases.get(fieldId)
			?? aliases.get(fieldId.toLowerCase())
			?? aliases.get(normalizeAlias(fieldId))
			?? null;
	}

	function getCapableFieldDefinition(fieldId, capabilityId) {
		const definition = getFieldDefinition(fieldId);
		return definition?.[capabilityId] ? definition : null;
	}

	function assertAliasAvailable(alias, definition) {
		for (const key of getAliasKeys(alias)) {
			const existing = aliases.get(key);
			if (existing && existing !== definition) {
				throw new Error(`Duplicate ${catalogName} field alias: ${alias}`);
			}
		}
	}

	function registerAlias(alias, definition) {
		for (const key of getAliasKeys(alias)) {
			aliases.set(key, definition);
		}
	}

	function assertMutable() {
		if (built) {
			throw new Error(`${catalogName} field catalog is already built.`);
		}
	}

	return Object.freeze({ addField, addSection, build });
}

function defineStoredField(path, type, options = {}) {
	return { ...options, path: Object.freeze([...path]), type };
}

function definePairInput(inputTargetIds) {
	return {
		inputKind: 'pair',
		inputTargetIds: Object.freeze([...inputTargetIds]),
	};
}

function getAliasKeys(alias) {
	if (typeof alias !== 'string' || alias.length === 0) {
		throw new TypeError('Field alias must be a non-empty string.');
	}
	return new Set([alias, alias.toLowerCase(), normalizeAlias(alias)]);
}

function normalizeAlias(value) {
	return value.toLowerCase().replace(/[^a-z]/g, '');
}

module.exports = {
	createFieldCatalogBuilder,
	definePairInput,
	defineStoredField,
};

const {
	formatResolvedLootItem,
	getResolvedBaseSelection,
	getResolvedLootArmorPercentage,
	getResolvedLootProvenance,
} = require('./lootGeneration');

function resolveGenerationTemplates(
	templates,
	{ locale, path, random, resolver },
) {
	if (typeof resolver?.resolveInlineString !== 'function') {
		throw new TypeError('Generation templates require inline-string resolution.');
	}
	return templates.map((template, index) => resolver.resolveInlineString(
		template,
		locale,
		{ path: `${path}.${index}`, random },
	).value);
}

function resolveFixedRules(
	fixedRules,
	{ createError, includeEntryId = false, locale, path, random, resolver },
) {
	const provenance = [];
	const rules = fixedRules.map((fixedRule, index) => {
		const resolved = resolveGenerationReference(
			{
				generator: 'rules',
				entry: fixedRule.entry,
				select: 'fields',
			},
			locale,
			random,
			resolver,
			`${path}.${index}`,
		);
		provenance.push(...resolved.provenance);
		return {
			...(includeEntryId ? { entryId: fixedRule.entry } : {}),
			name: requireLocalizedField(resolved.value, 'name', createError),
			description: requireLocalizedField(
				resolved.value,
				'description',
				createError,
			),
			level: fixedRule.level,
		};
	});
	return { provenance, rules };
}

function resolveDescribedReferences(
	references,
	{ createError, locale, path, random, resolver },
) {
	return references.map((reference, index) => {
		const resolved = resolveGenerationReference(
			reference,
			locale,
			random,
			resolver,
			`${path}.${index}`,
		);
		const selection = getEntrySelection(resolved.provenance, createError);
		const fields = resolved.displayFields ?? resolved.fields ?? resolved.value;
		return {
			generatorId: selection.generatorId,
			entryId: selection.entryId,
			name: requireLocalizedField(fields, 'name', createError),
			description: requireLocalizedField(
				fields,
				'description',
				createError,
			),
			provenance: resolved.provenance,
		};
	});
}

function resolveGearReferences(
	references,
	{ createError, locale, path, random, resolver },
) {
	const provenance = [];
	let armorPercentage = 0;
	const values = references.map((reference, index) => {
		const resolved = resolveGenerationReference(
			reference,
			locale,
			random,
			resolver,
			`${path}.${index}`,
		);
		provenance.push(...getResolvedLootProvenance(resolved));
		armorPercentage += getResolvedLootArmorPercentage(resolved);
		return formatReferenceValue(resolved, createError);
	});
	return { armorPercentage, provenance, values };
}

function resolveArmorReference(
	reference,
	{ createError, locale, path, random, resolver },
) {
	const resolved = resolveGenerationReference(
		reference,
		locale,
		random,
		resolver,
		path,
	);
	const selection = getResolvedBaseSelection(resolved);
	if (selection.generatorId !== 'armors') {
		throw createGenerationError(
			createError,
			'Generation armor must resolve from the armor generator.',
			'errors.generatorFieldMissing',
			{ field: 'armor' },
		);
	}
	let armorPercentage;
	try {
		armorPercentage = getResolvedLootArmorPercentage(resolved);
	}
	catch {
		throw createGenerationError(
			createError,
			'Generation armor requires a stable type and rarity modifier.',
			'errors.generatorFieldMissing',
			{ field: 'modifier_rarity' },
		);
	}
	return {
		armorPercentage,
		provenance: getResolvedLootProvenance(resolved),
		value: formatReferenceValue(resolved, createError),
	};
}

function resolveGenerationReference(reference, locale, random, resolver, path) {
	return resolver.resolveReference(reference, locale, { path, random });
}

function formatReferenceValue(resolved, createError) {
	try {
		return formatResolvedLootItem(resolved);
	}
	catch {
		throw createGenerationError(
			createError,
			'Generation gear requires readable localized text.',
			'errors.generatorTextExpected',
			{},
		);
	}
}

function requireLocalizedField(fields, field, createError) {
	const value = fields?.[field];
	if (typeof value !== 'string' || !value.trim()) {
		throw createGenerationError(
			createError,
			`Generation requires localized ${field}.`,
			'errors.generatorFieldMissing',
			{ field },
		);
	}
	return value;
}

function getEntrySelection(provenance, createError) {
	const selection = provenance.find(record => record.type === 'entry' && record.entryId);
	if (!selection) {
		throw createGenerationError(
			createError,
			'Generation reference omitted selection provenance.',
			'errors.generatorMissing',
			{ category: 'provenance' },
		);
	}
	return selection;
}

function createGenerationError(createError, message, translationKey, variables) {
	if (typeof createError === 'function') {
		return createError(message, translationKey, variables);
	}
	const error = new Error(message);
	error.translationKey = translationKey;
	error.translationVariables = variables;
	return error;
}

module.exports = {
	resolveArmorReference,
	resolveDescribedReferences,
	resolveFixedRules,
	resolveGearReferences,
	resolveGenerationTemplates,
};

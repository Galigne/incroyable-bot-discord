const {
	getArmorPercentage,
	getShieldPercentage,
} = require('./mechanics/armor');

const RARITY_MODIFIER_GENERATOR_ID = 'modifier_rarity';
const LOOT_MODIFIER_ORDER = Object.freeze([
	RARITY_MODIFIER_GENERATOR_ID,
	'modifier_material',
	'modifier_loot',
]);

function formatResolvedLootItem(result) {
	const baseValue = getResolvedBaseValue(result);
	const modifierValues = orderLootModifiers(result?.modifiers)
		.flatMap(formatResolvedModifier);
	return [baseValue, ...modifierValues].join(' — ');
}

function getResolvedBaseValue(result) {
	if (typeof result?.value === 'string' && result.value.trim()) {
		return result.value;
	}
	const fields = result?.displayFields ?? result?.fields;
	if (
		typeof fields?.name === 'string'
		&& fields.name.trim()
		&& typeof fields.description === 'string'
		&& fields.description.trim()
	) {
		return `${fields.name} — ${fields.description}`;
	}
	if (typeof result?.display === 'string' && result.display.trim()) {
		return result.display;
	}
	const values = Object.values(fields ?? {}).map(String).filter(value => value.trim());
	if (values.length > 0) {
		return values.join(' — ');
	}
	throw new TypeError('Loot resolution did not produce readable display text.');
}

function formatResolvedModifier(modifier) {
	return [
		getResolvedBaseValue(modifier),
		...orderLootModifiers(modifier?.modifiers).flatMap(formatResolvedModifier),
	];
}

function orderLootModifiers(modifiers = []) {
	return [...modifiers]
		.map((modifier, index) => ({
			index,
			modifier,
			priority: getModifierPriority(modifier?.generatorId),
		}))
		.sort((left, right) => (
			left.priority - right.priority || left.index - right.index
		))
		.map(candidate => candidate.modifier);
}

function getModifierPriority(generatorId) {
	const index = LOOT_MODIFIER_ORDER.indexOf(generatorId);
	return index === -1 ? LOOT_MODIFIER_ORDER.length : index;
}

function getResolvedLootArmorPercentage(result) {
	const selection = getResolvedBaseSelection(result);
	const rarityId = result?.modifiers?.find(modifier => (
		modifier.generatorId === RARITY_MODIFIER_GENERATOR_ID
	))?.entryId;
	if (selection.generatorId === 'armors') {
		return getArmorPercentage(result?.fields?.type, rarityId);
	}
	if (selection.generatorId === 'shields') {
		return getShieldPercentage(rarityId);
	}
	return 0;
}

function getResolvedBaseSelection(result) {
	if (result?.generatorId && result?.entryId) {
		return {
			entryId: result.entryId,
			generatorId: result.generatorId,
		};
	}
	const selection = result?.provenance?.find(record => (
		record.type === 'entry' && record.generatorId && record.entryId
	));
	return selection ?? {};
}

function getResolvedLootProvenance(result) {
	return [
		...(result?.provenance ?? []),
		...orderLootModifiers(result?.modifiers).flatMap(modifier => [
			...(modifier.provenance ?? []),
			...getResolvedLootProvenance({ modifiers: modifier.modifiers }),
		]),
	];
}

module.exports = {
	LOOT_MODIFIER_ORDER,
	RARITY_MODIFIER_GENERATOR_ID,
	formatResolvedLootItem,
	getResolvedBaseSelection,
	getResolvedLootArmorPercentage,
	getResolvedLootProvenance,
	orderLootModifiers,
};

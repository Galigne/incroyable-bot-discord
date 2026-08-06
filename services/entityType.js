const ENTITY_TYPES = Object.freeze(['character', 'creature']);

function assertEntityType(type) {
	if (!ENTITY_TYPES.includes(type)) {
		const error = new Error(`Unsupported entity type: ${type}.`);
		error.code = 'INVALID_ENTITY_TYPE';
		throw error;
	}
	return type;
}

module.exports = { ENTITY_TYPES, assertEntityType };

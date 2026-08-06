function generatorResolutionError(code, message) {
	const error = new Error(message);
	error.name = 'GeneratorResolutionError';
	error.code = code;
	return error;
}

module.exports = {
	generatorResolutionError,
};

const { authorizeCommand } = require('./authorization');

const dmOnlyCommand = {
	access: {
		role: 'dm',
	},
};

function canManageCharacters(message, config) {
	return authorizeCommand(dmOnlyCommand, message, config).allowed;
}

module.exports = { canManageCharacters };

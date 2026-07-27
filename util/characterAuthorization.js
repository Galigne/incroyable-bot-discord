const { authorizeCommand } = require('./authorization');

const dmOnlyCommand = {
	access: {
		role: 'dm',
	},
};

function canManageCharacters(interaction, config) {
	return authorizeCommand(dmOnlyCommand, interaction, config).allowed;
}

module.exports = { canManageCharacters };

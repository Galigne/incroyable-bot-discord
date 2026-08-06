const js = require('@eslint/js');
const globals = require('globals');

const commonRestrictedSyntax = [
	{
		selector: 'Property[key.name=\'ephemeral\']',
		message: 'Use MessageFlags.Ephemeral instead of the deprecated ephemeral option.',
	},
	{
		selector: 'MemberExpression[object.name=\'config\'][property.name=\'prefix\']',
		message: 'Prefix commands are not supported.',
	},
	{
		selector: 'MemberExpression[property.name=\'MessageCreate\']',
		message: 'Message commands are not supported.',
	},
	{
		selector: 'MemberExpression[property.name=\'MessageContent\']',
		message: 'The bot must not request the Message Content intent.',
	},
];

module.exports = [
	{
		ignores: [
			'node_modules/**',
			'save/**',
		],
	},
	{
		files: ['**/*.js'],
		languageOptions: {
			ecmaVersion: 'latest',
			globals: globals.node,
			sourceType: 'commonjs',
		},
		rules: {
			...js.configs.recommended.rules,
			'brace-style': ['error', 'stroustrup', { allowSingleLine: true }],
			'comma-dangle': ['error', 'always-multiline'],
			'comma-spacing': 'error',
			'comma-style': 'error',
			curly: ['error', 'multi-line', 'consistent'],
			'dot-location': ['error', 'property'],
			indent: ['error', 'tab'],
			'max-nested-callbacks': ['error', { max: 4 }],
			'max-statements-per-line': ['error', { max: 2 }],
			'no-console': 'off',
			'no-empty-function': 'error',
			'no-floating-decimal': 'error',
			'no-inline-comments': 'error',
			'no-lonely-if': 'error',
			'no-multi-spaces': 'error',
			'no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1, maxBOF: 0 }],
			'no-shadow': ['error', { allow: ['err', 'resolve', 'reject'] }],
			'no-trailing-spaces': 'error',
			'no-var': 'error',
			'object-curly-spacing': ['error', 'always'],
			'prefer-const': 'error',
			quotes: ['error', 'single'],
			semi: ['error', 'always'],
			'space-before-blocks': 'error',
			'space-before-function-paren': ['error', {
				anonymous: 'never',
				named: 'never',
				asyncArrow: 'always',
			}],
			'space-in-parens': 'error',
			'space-infix-ops': 'error',
			'space-unary-ops': 'error',
			'spaced-comment': 'error',
			yoda: 'error',
			'no-restricted-syntax': ['error', ...commonRestrictedSyntax],
		},
	},
	{
		files: ['models/**/*.js', 'services/**/*.js'],
		rules: {
			'no-restricted-modules': ['error', {
				patterns: [
					'discord.js',
					'@discordjs/*',
					'../util/i18n',
					'../../util/i18n',
				],
			}],
		},
	},
	{
		files: ['commands/**/*.js'],
		rules: {
			'no-restricted-modules': ['error', {
				patterns: [
					'../services/characterStore',
					'../services/creatureStore',
					'../services/mechanics/*',
					'../../services/characterStore',
					'../../services/creatureStore',
					'../../services/mechanics/*',
				],
			}],
			'no-restricted-syntax': ['error', ...commonRestrictedSyntax, {
				selector: 'NewExpression[callee.name=\'EmbedBuilder\']',
				message: 'Commands must use a response adapter to construct embeds.',
			}, {
				selector: 'NewExpression[callee.name=\'SlashCommandBuilder\']',
				message: 'Command schema must come from the centralized metadata registry.',
			}],
		},
	},
];

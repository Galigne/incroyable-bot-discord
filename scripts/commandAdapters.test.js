const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { MessageFlags } = require('discord.js');

const purgeCommand = require('../commands/handlers/purge');
const rulesCommand = require('../commands/handlers/rules');
const { t } = require('../util/i18n');

const repositoryRoot = path.join(__dirname, '..');
const rulebooks = {
	en: {
		file: path.join('documentation', 'TTRPG_RANDOM_RULES_EN.md'),
		url: 'https://github.com/Galigne/incroyable-bot-discord/blob/master/documentation/TTRPG_RANDOM_RULES_EN.md',
	},
	fr: {
		file: path.join('documentation', 'JDR_RANDOM_RULES_FR.md'),
		url: 'https://github.com/Galigne/incroyable-bot-discord/blob/master/documentation/JDR_RANDOM_RULES_FR.md',
	},
};

test('/rules links to the localized RANDOM rulebook through localization', async () => {
	for (const [locale, rulebook] of Object.entries(rulebooks)) {
		let reply;
		await rulesCommand.execute({
			config: { locale },
			interaction: {
				reply: async response => {
					reply = response;
				},
			},
		});

		assert.equal(
			reply,
			t(locale, 'rpg.rules.reply', { url: rulebook.url }),
		);
		assert.match(reply, new RegExp(rulebook.url.replaceAll('.', '\\.'), 'u'));
		assert.equal(reply.includes(rulebooks[locale === 'en' ? 'fr' : 'en'].url), false);
	}
});

test('/rules references rulebook files that exist in the repository', () => {
	for (const rulebook of Object.values(rulebooks)) {
		assert.equal(fs.existsSync(path.join(repositoryRoot, rulebook.file)), true, rulebook.file);
	}
});

test('/purge passes the requested amount and bulk-delete filter to Discord', async () => {
	const requestedAmount = 10;
	const bulkDeleteCalls = [];
	const interaction = createPurgeInteraction({
		locale: 'en',
		requestedAmount,
		deletedCount: 3,
		bulkDeleteCalls,
	});

	await purgeCommand.execute({ config: { locale: 'en' }, interaction });

	assert.deepEqual(bulkDeleteCalls, [[requestedAmount, true]]);
});

test('/purge acknowledges privately with a localized actual deletion count', async () => {
	for (const locale of ['en', 'fr']) {
		const requestedAmount = 10;
		const deletedCount = 3;
		let reply;
		const interaction = createPurgeInteraction({
			locale,
			requestedAmount,
			deletedCount,
			bulkDeleteCalls: [],
			onReply: response => {
				reply = response;
			},
		});

		await purgeCommand.execute({ config: { locale }, interaction });

		assert.deepEqual(reply, {
			content: t(locale, 'commands.purge.success', { count: deletedCount }),
			flags: MessageFlags.Ephemeral,
		});
		assert.equal(reply.content.includes(String(requestedAmount)), false);
	}
});

function createPurgeInteraction({
	bulkDeleteCalls,
	deletedCount,
	onReply = () => undefined,
	requestedAmount,
}) {
	return {
		channel: {
			bulkDelete: async (...args) => {
				bulkDeleteCalls.push(args);
				return { size: deletedCount };
			},
		},
		options: {
			getInteger: (name, required) => {
				assert.equal(name, 'amount');
				assert.equal(required, true);
				return requestedAmount;
			},
		},
		reply: async response => onReply(response),
	};
}

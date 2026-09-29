const assert = require('node:assert/strict');
const { test } = require('node:test');

const commandRegistry = require('../commands/registry');
const { loadConfig } = require('../util/configuration');

const config = loadConfig();
const {
	CHARACTER_SECTION_IDS,
	getEditableFields,
	getViewableFields,
} = require('../services/characterFieldCatalog');
const {
	CREATURE_SECTION_IDS,
} = require('../services/creatureFieldCatalog');
const generatorCatalog = require('../services/generatorCatalog');
const {
	createGeneratorTraversalAlias,
} = require('../services/generatorTraversal');
const { MAX_AUTOCOMPLETE_CHOICES } = require('../util/autocomplete');
const { createHelpResponse } = require('../util/helpResponses');

const AVATAR_URL = 'https://example.com/avatar.png';

test('/help lists only commands available to a regular player', () => {
	const rendered = renderOverview(createInteraction('regular'));
	assert.match(rendered, /General/);
	assert.match(rendered, /RPG/);
	assert.match(rendered, /\*\*\/help\*\*/);
	assert.match(rendered, /\*\*\/roll\*\*/);
	assert.match(rendered, /\*\*\/gen\*\*/);
	assert.doesNotMatch(rendered, /\*\*\/gen-character\*\*/);
	assert.doesNotMatch(rendered, /\*\*\/gen-creature\*\*/);
	assert.doesNotMatch(rendered, /\*\*\/say\*\*/);
});

test('/help lists unrestricted and DM-only generation commands for a DM', () => {
	const rendered = renderOverview(createInteraction('dm', [config.roles.dm]));
	assert.match(rendered, /\*\*\/gen\*\*/);
	assert.match(rendered, /\*\*\/gen-character\*\*/);
	assert.match(rendered, /\*\*\/gen-creature\*\*/);
	assert.doesNotMatch(rendered, /\*\*\/say\*\*/);
});

test('/help lists moderation commands for a moderator', () => {
	const rendered = renderOverview(createInteraction(
		'moderator',
		[config.roles.moderator],
	));
	assert.match(rendered, /Moderation/);
	assert.match(rendered, /\*\*\/say\*\*/);
	assert.match(rendered, /\*\*\/purge\*\*/);
	assert.match(rendered, /\*\*\/reload\*\*/);
	assert.match(rendered, /\*\*\/gen\*\*/);
	assert.doesNotMatch(rendered, /\*\*\/gen-character\*\*/);
	assert.doesNotMatch(rendered, /\*\*\/gen-creature\*\*/);
});

test('/help lists every executable command for the server owner', () => {
	const interaction = createInteraction('owner', [], 'owner');
	const response = createOverview(interaction);
	const rendered = JSON.stringify(response.embeds[0].toJSON());
	for (const metadata of commandRegistry.getHelpMetadata()) {
		const invocation = metadata.parent
			? `/${metadata.parent} ${metadata.name}`
			: `/${metadata.name}`;
		assert.ok(rendered.includes(`**${invocation}**`), invocation);
	}
});

test('/help command:<command> renders centralized command details', () => {
	const response = createHelpResponse({
		avatarUrl: AVATAR_URL,
		commandName: 'roll',
		config,
		interaction: createInteraction('regular'),
		locale: 'en',
		registry: commandRegistry,
	});
	const embed = response.embeds[0].toJSON();
	const rendered = JSON.stringify(embed);
	assert.equal(embed.title, 'Help — /roll');
	assert.match(rendered, /Required permission/);
	assert.match(rendered, /expression/);
	assert.match(rendered, /Optional/);
	assert.match(rendered, /Without an expression, rolls `1d20`/);
	assert.match(rendered, /`\/roll`/);
	assert.match(rendered, /COUNTdSIDES/);
	assert.match(rendered, /2d6\+3/);
	assert.match(rendered, /Multiple dice groups/);
});

test('/help command:gen lists every localized generator category', () => {
	const interaction = createInteraction('regular');
	for (const locale of ['en', 'fr']) {
		const categories = generatorCatalog.listGenerators(locale);
		assert.ok(categories.length > 0);
		const categoryIds = new Set(categories.map(category => category.id));
		assert.ok(categoryIds.has('aspect'));
		assert.ok(['ability', 'element', 'weakness'].every(id => !categoryIds.has(id)));
		const rendered = renderDetail('gen', interaction, locale);
		for (const category of categories) {
			const alias = createGeneratorTraversalAlias(category.name);
			assert.ok(rendered.includes(`\`${alias}\``), `${locale}: ${alias}`);
			assert.ok(
				rendered.includes(category.description),
				`${locale}: ${category.description}`,
			);
		}
		for (const example of locale === 'fr'
			? ['butin:armes:épée_longue', 'butin:armes.description']
			: ['loot:weapons:long_sword', 'loot:weapons.description']) {
			assert.ok(rendered.includes(example), `${locale}: ${example}`);
		}
	}
});

test('/help command:get and command:set list both explicit entity field orders', () => {
	const fields = getEditableFields();
	assert.deepEqual(fields.map(field => field.editId), CHARACTER_SECTION_IDS);
	assert.deepEqual(
		getViewableFields().map(field => field.viewId),
		CHARACTER_SECTION_IDS,
	);
	for (const [locale] of [
		['en', ['General fields', 'Statistics', 'Resources']],
		['fr', ['Champs généraux', 'Statistiques', 'Ressources']],
	]) {
		const rendered = renderDetail(
			'set',
			createInteraction('regular'),
			locale,
		);
		for (const field of fields) {
			assert.ok(rendered.includes(`\`${field.editId}\``), `${locale}: ${field.editId}`);
		}
		for (const fieldId of CREATURE_SECTION_IDS) {
			assert.ok(rendered.includes(`\`${fieldId}\``), `${locale}: ${fieldId}`);
		}
		assert.ok(rendered.includes('`settings`'), locale);
		for (const removedField of [
			'firstName',
			'lastName',
			'backstory',
			'goals',
			'racialTraits',
			'status-effects',
			'hp',
			'ar',
			'ap',
			'md',
			'equipment',
			'inventory',
			'encumbrance',
		]) {
			assert.equal(rendered.includes(`\`${removedField}\``), false);
		}
		const getRendered = renderDetail('get', createInteraction('regular'), locale);
		assert.ok(getRendered.includes('`all`'), locale);
		assert.equal(getRendered.includes('`settings`'), false, locale);
		assert.equal(rendered.includes('`all`'), false, locale);
		for (const field of fields) {
			assert.ok(getRendered.includes(`\`${field.viewId}\``), `${locale}: ${field.viewId}`);
		}
	}
	for (const [locale, formats] of [
		['en', [
			'edit-only `settings` group',
			'Visibility accepts only `public` or `private`',
			'`<Discord user ID>:owner`',
			'partial users retain ordinary editing',
			'Settings changes create no gameplay-history entry',
		]],
		['fr', [
			'groupe `settings`',
			'accepte uniquement `public` ou `private`',
			'`<identifiant Discord>:owner`',
			'les accès `partial` conservent les modifications ordinaires',
			'paramètres répond toujours en privé',
		]],
	]) {
		const rendered = renderDetail('set', createInteraction('regular'), locale);
		for (const format of formats) {
			assert.ok(rendered.includes(format), `${locale}: ${format}`);
		}
	}
	assert.equal(
		renderDetail('set', createInteraction('regular'), 'en').includes('`firstName:lastName`'),
		false,
	);
});

test('/help command:get explains summary plus gear, field:all, and individual fields', () => {
	for (const [locale, expectedBehavior] of [
		[
			'en',
			[
				'Without `field`, posts the entity summary followed by its `gear` category',
				'Private entities are discoverable and readable only',
				'`field:all` skips the summary',
				'Character categories use `name`, `level`, `resources`, `status`',
				'Creature categories use the independent order `identity`',
			],
		],
		[
			'fr',
			[
				'Sans `field`, publie le résumé de l’entité puis sa catégorie `gear`',
				'Les entités privées ne peuvent être découvertes et consultées',
				'Avec `field:all`, n’affiche pas le résumé',
				'Les catégories de personnage sont `name`, `level`, `resources`, `status`',
				'Les catégories de créature suivent leur propre ordre',
			],
		],
	]) {
		const rendered = renderDetail('get', createInteraction('regular'), locale);
		assert.ok(rendered.includes('`/get entity-key:<key>`'), locale);
		assert.ok(
			rendered.includes('`/get entity-key:<key> field:<field>`'),
			locale,
		);
		assert.ok(
			rendered.includes('`/get entity-key:<key> field:all`'),
			locale,
		);
		for (const behavior of expectedBehavior) {
			assert.ok(rendered.includes(behavior), `${locale}: ${behavior}`);
		}
	}
});

test('/help command:undo explains retention, consumption, and the lack of redo', () => {
	for (const [locale, expectedBehavior] of [
		[
			'en',
			[
				'without changing its current key, type, or complete Settings',
				'current `characterHistory.maxEntries` limit applies to both types',
				'characterHistory.maxEntries',
				'Repeated undos walk backward',
				'redo is unsupported',
			],
		],
		[
			'fr',
			[
				'sans changer sa clé actuelle, son type ni l’intégralité de ses paramètres actuels',
				's’applique aux deux types',
				'characterHistory.maxEntries',
				'Des annulations répétées',
				'aucun rétablissement',
			],
		],
	]) {
		const rendered = renderDetail(
			'undo',
			createInteraction('regular'),
			locale,
		);
		assert.ok(rendered.includes('`/undo entity-key:<key>`'), locale);
		for (const behavior of expectedBehavior) {
			assert.ok(rendered.includes(behavior), `${locale}: ${behavior}`);
		}
	}
});

test('/help rejects unknown and unavailable commands', () => {
	for (const commandName of ['missing', 'gen-character']) {
		const response = createHelpResponse({
			avatarUrl: AVATAR_URL,
			commandName,
			config,
			interaction: createInteraction('regular'),
			locale: 'en',
			registry: commandRegistry,
		});
		assert.match(response.content, /Unknown command or unavailable command/);
		assert.ok(response.flags);
	}
});

test('/help command autocomplete filters commands by permission', async () => {
	const cases = [
		{
			interaction: createInteraction('regular'),
			includes: ['gen', 'roll'],
			excludes: ['gen-character', 'gen-creature', 'say'],
		},
		{
			interaction: createInteraction('dm', [config.roles.dm]),
			includes: ['gen', 'gen-character', 'gen-creature'],
			excludes: ['say'],
		},
		{
			interaction: createInteraction('moderator', [config.roles.moderator]),
			includes: ['gen', 'say'],
			excludes: ['gen-character', 'gen-creature'],
		},
		{
			interaction: createInteraction('owner', [], 'owner'),
			includes: ['gen', 'say'],
			excludes: [],
		},
	];
	for (const entry of cases) {
		const choices = await autocomplete(entry.interaction);
		const values = choices.map(choice => choice.value);
		for (const value of entry.includes) {
			assert.ok(values.includes(value), `${entry.interaction.user.id}: ${value}`);
		}
		for (const value of entry.excludes) {
			assert.equal(values.includes(value), false, `${entry.interaction.user.id}: ${value}`);
		}
	}
});

test('/help autocomplete falls back to every command without member role data', async () => {
	const interaction = createInteraction('partial');
	delete interaction.member;
	const choices = await autocomplete(interaction);
	const values = choices.map(choice => choice.value);
	assert.ok(values.includes('gen'));
	assert.ok(values.includes('say'));
});

test('autocomplete respects Discord\'s 25-choice limit and filters values', async () => {
	const regular = createInteraction('regular');
	const initialCategories = await autocompleteOption('gen', 'category', '', regular);
	assert.equal(
		initialCategories.length,
		Math.min(
			generatorCatalog.listGenerators('en').length,
			MAX_AUTOCOMPLETE_CHOICES,
		),
	);
	assert.ok(initialCategories.length <= MAX_AUTOCOMPLETE_CHOICES);
	assert.ok(initialCategories.every(choice => choice.name === choice.value));
	const filteredCategories = await autocompleteOption(
		'gen',
		'category',
		'loot:wea',
		regular,
	);
	assert.equal(filteredCategories.length, 1);
	assert.equal(filteredCategories[0].value, 'loot:weapons');

	assert.deepEqual(
		await autocompleteOption(
			'set',
			'field',
			'derived-statistics',
			createInteraction('regular'),
		),
		[],
	);
	assert.deepEqual(
		await autocompleteOption(
			'set',
			'field',
			'statistics',
			createInteraction('regular'),
		),
		[],
	);
});

test('field autocomplete reveals nothing without a resolved visible entity', async () => {
	for (const locale of ['en', 'fr']) {
		for (const query of ['', 'stat', 'gear']) {
			const getChoices = await autocompleteOption(
				'get', 'field', query, createInteraction('regular'), locale,
			);
			const setChoices = await autocompleteOption(
				'set', 'field', query, createInteraction('regular'), locale,
			);
			assert.deepEqual(getChoices, [], `${locale}: get ${query}`);
			assert.deepEqual(setChoices, [], `${locale}: set ${query}`);
		}
	}
});

test('/help overview and details are localized in English and French', () => {
	const interaction = createInteraction('regular');
	const english = createOverview(interaction, 'en').embeds[0].toJSON();
	const french = createOverview(interaction, 'fr').embeds[0].toJSON();
	assert.equal(english.title, 'Command Help');
	assert.equal(french.title, 'Aide des commandes');
	assert.match(JSON.stringify(english), /RPG/);
	assert.match(JSON.stringify(french), /JDR/);

	const frenchDetail = createHelpResponse({
		avatarUrl: AVATAR_URL,
		commandName: 'roll',
		config,
		interaction,
		locale: 'fr',
		registry: commandRegistry,
	}).embeds[0].toJSON();
	const rendered = JSON.stringify(frenchDetail);
	assert.equal(frenchDetail.title, 'Aide — /roll');
	assert.match(rendered, /Permission requise/);
	assert.match(rendered, /Facultatif/);
	assert.match(rendered, /Sans expression, lance `1d20`/);
	assert.match(rendered, /NOMBREdFACES/);
});

test('only /help remains in the registered help interface', () => {
	const registered = commandRegistry.getDiscordCommandData()
		.map(data => data.toJSON());
	const help = registered.find(command => command.name === 'help');
	assert.deepEqual(help.options.map(option => option.name), ['command']);
	assert.equal(help.options[0].autocomplete, true);
	assert.equal(registered.some(command => command.name === 'rpg'), false);
	assert.equal(registered.some(command => (
		command.name === 'help' || command.name.endsWith('-help')
	) && command.name !== 'help'), false);
	assert.ok(commandRegistry.getHelpMetadata().every(metadata => (
		metadata.help.detailsKey
	)));
});

function createOverview(interaction, locale = 'en') {
	return createHelpResponse({
		avatarUrl: AVATAR_URL,
		config,
		interaction,
		locale,
		registry: commandRegistry,
	});
}

function renderOverview(interaction, locale = 'en') {
	return JSON.stringify(createOverview(interaction, locale).embeds[0].toJSON());
}

function renderDetail(commandName, interaction, locale = 'en') {
	return JSON.stringify(createHelpResponse({
		avatarUrl: AVATAR_URL,
		commandName,
		config,
		interaction,
		locale,
		registry: commandRegistry,
	}).embeds[0].toJSON());
}

async function autocomplete(interaction) {
	let response;
	interaction.options = {
		getFocused: () => ({ name: 'command', value: '' }),
	};
	interaction.respond = async choices => {
		response = choices;
	};
	await commandRegistry.getRuntimeCommands().get('help').autocomplete({
		config,
		interaction,
	});
	return response;
}

async function autocompleteOption(commandName, optionName, value, interaction, locale = 'en') {
	let response;
	interaction.options = {
		getFocused: () => ({ name: optionName, value }),
	};
	interaction.respond = async choices => {
		response = choices;
	};
	await commandRegistry.getRuntimeCommands().get(commandName).autocomplete({
		config: { ...config, locale },
		interaction,
	});
	return response;
}

function createInteraction(userId, roleIds = [], ownerId = 'owner') {
	return {
		guild: { ownerId },
		guildId: 'guild',
		member: {
			roles: {
				cache: {
					has: roleId => roleIds.includes(roleId),
				},
			},
		},
		options: {
			getString: () => null,
		},
		user: { id: userId },
	};
}

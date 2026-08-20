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
	assert.doesNotMatch(rendered, /\*\*\/gen\*\*/);
	assert.doesNotMatch(rendered, /\*\*\/say\*\*/);
});

test('/help lists DM-only commands for a DM', () => {
	const rendered = renderOverview(createInteraction('dm', [config.roles.dm]));
	assert.match(rendered, /\*\*\/gen\*\*/);
	assert.match(rendered, /\*\*\/gen-char\*\*/);
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
	assert.doesNotMatch(rendered, /\*\*\/gen\*\*/);
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
	assert.match(rendered, /COUNTdSIDES/);
	assert.match(rendered, /2d6\+3/);
	assert.match(rendered, /Multiple dice groups/);
});

test('/help command:gen lists every localized generator category', () => {
	const interaction = createInteraction('dm', [config.roles.dm]);
	for (const locale of ['en', 'fr']) {
		const categories = generatorCatalog.listGenerators(locale);
		assert.ok(categories.length > 0);
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
		for (const field of fields) {
			assert.ok(getRendered.includes(`\`${field.viewId}\``), `${locale}: ${field.viewId}`);
		}
	}
	for (const [locale, formats] of [
		['en', [
			'`current:max` pairs for resources and encumbrance',
			'`statName:value` lines for all nine statistics exactly once',
			'`Name:Level:Description` per RULE',
			'`Name:Description` per status effect or descriptive modifier',
			'Plain collections, including creature intrinsic traits, use one entry per line; surrounding whitespace is trimmed',
			'Creature edits also require level 1–10',
			'EntityKey, type, access, schema metadata',
		]],
		['fr', [
			'des paires de nombres pour les ressources et l’encombrement',
			'des lignes `statName:valeur` avec chacun des neuf noms exactement une fois',
			'`Nom:Niveau:Description` pour chaque LOI',
			'`Nom:Description` pour chaque effet d’état ou modificateur descriptif',
			'Les collections simples, dont les dons intrinsèques des créatures, utilisent une entrée par ligne ; les espaces autour de chaque ligne sont supprimés',
			'Les créatures exigent aussi un niveau de 1 à 10',
			'L’EntityKey, le type, les accès, le schéma',
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

test('/help command:get explains summary, detailed field, and autocomplete behavior', () => {
	for (const [locale, expectedBehavior] of [
		[
			'en',
			[
				'Without `field`, posts the public entity summary.',
				'Character fields use `name`, `level`, `resources`, `status`',
				'Creature fields use the independent order `identity`',
			],
		],
		[
			'fr',
			[
				'Sans `field`, publie le résumé public de l’entité.',
				'Les champs de personnage sont `name`, `level`, `resources`, `status`',
				'Les champs de créature suivent leur propre ordre',
			],
		],
	]) {
		const rendered = renderDetail('get', createInteraction('regular'), locale);
		assert.ok(rendered.includes('`/get entity-key:<key>`'), locale);
		assert.ok(
			rendered.includes('`/get entity-key:<key> field:<field>`'),
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
				'without changing its type or current access list',
				'current `characterHistory.maxEntries` limit applies to both types',
				'characterHistory.maxEntries',
				'Repeated undos walk backward',
				'redo is unsupported',
			],
		],
		[
			'fr',
			[
				'sans changer son type ni sa liste d’accès actuelle',
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
	for (const commandName of ['missing', 'gen']) {
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
			includes: ['roll'],
			excludes: ['gen', 'say'],
		},
		{
			interaction: createInteraction('dm', [config.roles.dm]),
			includes: ['gen', 'gen-char', 'gen-creature'],
			excludes: ['say'],
		},
		{
			interaction: createInteraction('moderator', [config.roles.moderator]),
			includes: ['say'],
			excludes: ['gen'],
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
	const dm = createInteraction('dm', [config.roles.dm]);
	const initialCategories = await autocompleteOption('gen', 'category', '', dm);
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
		dm,
	);
	assert.equal(filteredCategories.length, 1);
	assert.equal(filteredCategories[0].value, 'loot:weapons');

	const initialFields = await autocompleteOption(
		'set',
		'field',
		'',
		createInteraction('regular'),
	);
	assert.deepEqual(
		initialFields.map(choice => choice.value),
		[
			...getEditableFields().map(field => field.editId),
			...CREATURE_SECTION_IDS.filter(id => !CHARACTER_SECTION_IDS.includes(id)),
		],
	);
	assert.deepEqual(
		await autocompleteOption(
			'set',
			'field',
			'derived-statistics',
			createInteraction('regular'),
		),
		[],
	);
	assert.ok((await autocompleteOption(
		'set',
		'field',
		'statistics',
		createInteraction('regular'),
	)).some(choice => choice.value === 'statistics'));
});

test('/get and /set autocomplete return identical localized section choices', async () => {
	for (const locale of ['en', 'fr']) {
		for (const query of ['', 'stat', 'gear']) {
			const getChoices = await autocompleteOption(
				'get', 'field', query, createInteraction('regular'), locale,
			);
			const setChoices = await autocompleteOption(
				'set', 'field', query, createInteraction('regular'), locale,
			);
			assert.deepEqual(getChoices, setChoices, `${locale}: ${query}`);
			assert.ok(getChoices.every(choice => (
				[
					...CHARACTER_SECTION_IDS,
					...CREATURE_SECTION_IDS,
				].includes(choice.value)
					&& choice.name.includes(`(${choice.value})`)
			)));
		}
	}
	const english = await autocompleteOption(
		'get', 'field', '', createInteraction('regular'), 'en',
	);
	assert.deepEqual(english.map(choice => choice.value), [
		...CHARACTER_SECTION_IDS,
		...CREATURE_SECTION_IDS.filter(id => !CHARACTER_SECTION_IDS.includes(id)),
	]);
	const french = await autocompleteOption(
		'get', 'field', '', createInteraction('regular'), 'fr',
	);
	assert.match(french.find(choice => choice.value === 'status').name, /État \(status\)/);
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

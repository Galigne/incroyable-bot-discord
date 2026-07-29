const assert = require('node:assert/strict');
const { test } = require('node:test');

const commandRegistry = require('../commands/registry');
const config = require('../config.json');
const { getEditableFields } = require('../services/characterFieldCatalog');
const generatorCatalog = require('../services/generatorCatalog');
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
		assert.ok(categories.length > MAX_AUTOCOMPLETE_CHOICES);
		const rendered = renderDetail('gen', interaction, locale);
		for (const category of categories) {
			assert.ok(rendered.includes(`\`${category.id}\``), `${locale}: ${category.id}`);
			assert.ok(
				rendered.includes(category.description),
				`${locale}: ${category.description}`,
			);
		}
	}
});

test('/help command:set lists every localized editable field by section', () => {
	const fields = getEditableFields();
	assert.ok(fields.length > MAX_AUTOCOMPLETE_CHOICES);
	for (const [locale, expectedHeadings] of [
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
		for (const heading of expectedHeadings) {
			assert.ok(rendered.includes(`**${heading}**`), `${locale}: ${heading}`);
		}
	}
});

test('/help command:get explains summary, detailed field, and autocomplete behavior', () => {
	for (const [locale, expectedBehavior] of [
		[
			'en',
			[
				'Without `field`, posts the public character summary.',
				'With `field`, displays one complete detailed field and its sub-fields.',
				'Autocomplete lists CharacterKeys and supported views',
			],
		],
		[
			'fr',
			[
				'Sans `field`, publie le résumé public du personnage.',
				'Avec `field`, affiche un champ complet et ses sous-champs.',
				'L’autocomplétion propose les CharacterKeys et les vues prises en charge',
			],
		],
	]) {
		const rendered = renderDetail('get', createInteraction('regular'), locale);
		assert.ok(rendered.includes('`/get character-key:<key>`'), locale);
		assert.ok(
			rendered.includes('`/get character-key:<key> field:<field>`'),
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
				'complete pre-change character state',
				'Three backups are retained by default',
				'characterHistory.maxEntries',
				'Undo does not save the displaced state',
				'redo is not supported',
			],
		],
		[
			'fr',
			[
				'état complet du personnage avant la modification',
				'Trois sauvegardes sont conservées par défaut',
				'characterHistory.maxEntries',
				'L’annulation n’enregistre pas l’état remplacé',
				'aucune fonction de rétablissement',
			],
		],
	]) {
		const rendered = renderDetail(
			'undo',
			createInteraction('regular'),
			locale,
		);
		assert.ok(rendered.includes('`/undo character-key:<key>`'), locale);
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
			includes: ['gen', 'gen-char'],
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

test('autocomplete filters values beyond Discord\'s 25-choice display limit', async () => {
	const dm = createInteraction('dm', [config.roles.dm]);
	const initialCategories = await autocompleteOption('gen', 'category', '', dm);
	assert.equal(initialCategories.length, MAX_AUTOCOMPLETE_CHOICES);
	const filteredCategories = await autocompleteOption(
		'gen',
		'category',
		'weapons',
		dm,
	);
	assert.equal(filteredCategories.length, 1);
	assert.equal(filteredCategories[0].value, 'weapons');

	const initialFields = await autocompleteOption(
		'set',
		'field',
		'',
		createInteraction('regular'),
	);
	assert.equal(initialFields.length, MAX_AUTOCOMPLETE_CHOICES);
	assert.ok(
		(await autocompleteOption(
			'set',
			'field',
			'md.max',
			createInteraction('regular'),
		)).some(choice => choice.value === 'md.max'),
	);
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

async function autocompleteOption(commandName, optionName, value, interaction) {
	let response;
	interaction.options = {
		getFocused: () => ({ name: optionName, value }),
	};
	interaction.respond = async choices => {
		response = choices;
	};
	await commandRegistry.getRuntimeCommands().get(commandName).autocomplete({
		config,
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

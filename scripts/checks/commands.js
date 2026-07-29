module.exports = function createCommandChecks(context) {
	const {
		errors,
		fs,
		loadCommands,
		path,
		root,
	} = context;
	const commandRegistry = require('../../commands/registry');
	const { getEditableFields, getViewableFields } = require(
		'../../services/characterFieldCatalog',
	);
	const { t } = require('../../util/i18n');

	function checkCommands() {
		try {
			return loadCommands();
		}
		catch (error) {
			errors.push(error.stack);
			return new Map();
		}
	}

	function checkRpgStructure(commands) {
		const rpgCommand = commands.get('rpg');
		const expectedSubcommands = commandRegistry.getAllCommands()
			.filter(metadata => metadata.parent === 'rpg');
		if (!rpgCommand?.subcommands) {
			errors.push('The RPG command must expose its registry-backed subcommands.');
			return;
		}

		const expectedNames = expectedSubcommands.map(metadata => metadata.name).sort();
		const actualNames = [...rpgCommand.subcommands.keys()].sort();
		if (actualNames.join(',') !== expectedNames.join(',')) {
			errors.push('The RPG runtime routes do not match the command registry.');
		}
		for (const metadata of expectedSubcommands) {
			const subcommand = rpgCommand.subcommands.get(metadata.name);
			if (
				subcommand?.metadata !== metadata
				|| typeof subcommand.execute !== 'function'
			) {
				errors.push(`Invalid registry-backed RPG subcommand: ${metadata.name}.`);
			}
		}
		checkHelpOrder(rpgCommand.subcommands.values(), 'RPG subcommands');
		const generationOrder = ['rpg:gen', 'rpg:gen-char', 'rpg:gen-help']
			.map(id => commandRegistry.getCommand(id))
			.sort((left, right) => left.help.order - right.help.order)
			.map(metadata => metadata.id);
		if (generationOrder.join(',') !== 'rpg:gen,rpg:gen-char,rpg:gen-help') {
			errors.push('RPG generation commands are not in the requested help order.');
		}
	}

	function checkSlashCommandData(commands) {
		const topLevelMetadata = commandRegistry.getAllCommands()
			.filter(metadata => !metadata.parent);
		const expectedNames = topLevelMetadata.map(metadata => metadata.name).sort();
		if ([...commands.keys()].sort().join(',') !== expectedNames.join(',')) {
			errors.push('Loaded slash commands do not match the command registry.');
		}

		for (const metadata of topLevelMetadata) {
			const command = commands.get(metadata.name);
			const data = command?.data?.toJSON();
			if (
				command?.metadata !== metadata
				|| data?.name !== metadata.name
				|| data?.description !== t('en', metadata.descriptionKey)
				|| command.usage !== metadata.examples[0]
			) {
				errors.push(`Invalid registry-backed slash command: ${metadata.name}.`);
			}
			const expectedOptions = metadata.group
				? commandRegistry.getAllCommands()
					.filter(candidate => candidate.parent === metadata.name)
				: metadata.options;
			checkRegisteredOptions(data?.options ?? [], expectedOptions, metadata.group);
		}

		const setHelp = t('en', 'rpg.setHelp.body');
		const getHelp = t('en', 'rpg.getHelp.body');
		const editableFields = getEditableFields();
		const viewableFields = getViewableFields();
		if (
			editableFields.length < 30
			|| !viewableFields.some(field => field.viewId === 'personality')
			|| !viewableFields.some(field => field.viewId === 'status')
			|| setHelp.length > 2_000
			|| getHelp.length > 2_000
			|| !setHelp.includes('prefilled form')
			|| !setHelp.includes('`Name: Level: Description`')
			|| /\b(add|set|remove) <(?:value|position)>/.test(setHelp)
		) {
			errors.push('The RPG editor or viewer help is incomplete or exceeds Discord limits.');
		}

		const indexSource = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
		const clientSource = fs.readFileSync(path.join(root, 'client', 'Client.js'), 'utf8');
		if (
			indexSource.includes('MessageCreate')
			|| indexSource.includes('config.prefix')
			|| clientSource.includes('MessageContent')
		) {
			errors.push('Obsolete prefix-command handling or Message Content intent remains.');
		}
	}

	function checkRegisteredOptions(registered, expected, subcommands = false) {
		if (registered.length !== expected.length) {
			errors.push('Registered command options do not match registry metadata.');
			return;
		}
		for (const metadata of expected) {
			const option = registered.find(candidate => candidate.name === metadata.name);
			if (!option || option.description !== t('en', metadata.descriptionKey)) {
				errors.push(`Missing registered option or subcommand: ${metadata.name}.`);
				continue;
			}
			const expectedOptions = subcommands ? metadata.options : [];
			if (subcommands) {
				checkRegisteredOptions(option.options ?? [], expectedOptions);
			}
			else if (
				Boolean(option.autocomplete) !== Boolean(metadata.autocomplete)
				|| Boolean(option.required) !== Boolean(metadata.required)
				|| (option.choices ?? []).map(choice => choice.value).join(',')
					!== (metadata.choices ?? []).map(choice => choice.value).join(',')
			) {
				errors.push(`Registered option differs from metadata: ${metadata.name}.`);
			}
		}
	}

	function checkHelpOrder(entries, label) {
		const orders = new Set();
		for (const entry of entries) {
			if (!Number.isFinite(entry.helpOrder)) {
				errors.push(`${entry.name} is missing a numeric helpOrder.`);
			}
			else if (orders.has(entry.helpOrder)) {
				errors.push(`Duplicate helpOrder ${entry.helpOrder} in ${label}.`);
			}
			orders.add(entry.helpOrder);
		}
	}

	return {
		checkCommands,
		checkRpgStructure,
		checkSlashCommandData,
		checkHelpOrder,
	};
};

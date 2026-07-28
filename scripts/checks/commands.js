module.exports = function createCommandChecks(context) {
	const {
		errors,
		fs,
		loadCommands,
		path,
		root,
	} = context;

	function checkCommands() {
		try {
			return loadCommands(path.join(root, 'commands'));
		}
		catch (error) {
			errors.push(error.stack);
			return new Map();
		}
	}

	function checkRpgStructure(commands) {
		const rpgCommand = commands.get('rpg');
		if (!rpgCommand?.subcommands) {
			errors.push('The RPG command must expose its subcommands.');
			return;
		}

		const expectedSubcommands = [
			'add',
			'damage',
			'delete',
			'end-turn',
			'gen',
			'gen-char',
			'gen-help',
			'get',
			'get-help',
			'heal',
			'help',
			'roll',
			'rules',
			'set',
			'set-help',
		];
		const actualSubcommands = [...rpgCommand.subcommands.keys()].sort();
		if (actualSubcommands.join(',') !== expectedSubcommands.join(',')) {
			errors.push(`Unexpected RPG subcommands: ${actualSubcommands.join(', ')}`);
		}
		for (const subcommand of rpgCommand.subcommands.values()) {
			if (
				!subcommand.description
				|| !subcommand.usage
				|| !Number.isFinite(subcommand.helpOrder)
				|| typeof subcommand.configure !== 'function'
				|| typeof subcommand.execute !== 'function'
			) {
				errors.push(`Invalid RPG subcommand: ${subcommand.name}`);
			}
		}
		checkHelpOrder(rpgCommand.subcommands.values(), 'RPG subcommands');
		const generationHelpOrder = [
			'gen',
			'gen-char',
			'gen-help',
		].sort((left, right) => (
			rpgCommand.subcommands.get(left).helpOrder
			- rpgCommand.subcommands.get(right).helpOrder
		));
		if (generationHelpOrder.join(',') !== 'gen,gen-char,gen-help') {
			errors.push('RPG generation commands are not in the requested help order.');
		}
	}

	function checkSlashCommandData(commands) {
		const expectedCommands = ['help', 'purge', 'restart', 'rpg', 'say'];
		if ([...commands.keys()].sort().join(',') !== expectedCommands.join(',')) {
			errors.push(`Unexpected slash commands: ${[...commands.keys()].sort().join(', ')}.`);
		}

		for (const command of commands.values()) {
			const data = command.data.toJSON();
			if (
				data.name !== command.name
				|| data.description !== command.description
				|| command.usage.startsWith('!')
			) {
				errors.push(`Invalid slash-command metadata: ${command.name}.`);
			}
		}

		const rpgCommand = commands.get('rpg');
		const { EDIT_FIELDS } = require('../../commands/rpg/editorFields');
		const { SET_HELP } = require('../../commands/rpg/subcommands/set');
		const { GET_FIELDS, GET_HELP } = require('../../commands/rpg/subcommands/get');
		if (
			EDIT_FIELDS.length < 30
			|| !GET_FIELDS.includes('personality')
			|| !GET_FIELDS.includes('status')
			|| SET_HELP.length > 2_000
			|| GET_HELP.length > 2_000
			|| !SET_HELP.includes('prefilled form')
			|| !SET_HELP.includes('`Name: Level: Description`')
			|| /\b(add|set|remove) <(?:value|position)>/.test(SET_HELP)
		) {
			errors.push('The RPG editor or viewer help is incomplete or exceeds Discord limits.');
		}

		const slashSubcommands = rpgCommand.data.toJSON().options.map(option => option.name);
		if (
			slashSubcommands.length !== rpgCommand.subcommands.size
			|| slashSubcommands.some(name => !rpgCommand.subcommands.has(name))
		) {
			errors.push('The /rpg schema and routed subcommands do not match.');
		}

		const rpgData = rpgCommand.data.toJSON();
		const getSubcommand = name => rpgData.options.find(option => option.name === name);
		const hasAutocomplete = (subcommand, optionName) => getSubcommand(subcommand)
			?.options.find(option => option.name === optionName)?.autocomplete === true;
		const healResourceChoices = getSubcommand('heal')
			?.options.find(option => option.name === 'resource')?.choices;
		const healPercentage = getSubcommand('heal')
			?.options.find(option => option.name === 'percentage');
		if (
			healResourceChoices?.map(choice => choice.value).join(',')
				!== 'hp,armor,both'
			|| healResourceChoices?.map(choice => choice.name).join(',')
				!== 'HP — Hit points,AR — Armor rating,HP and AR'
			|| healPercentage?.min_value !== 0
			|| healPercentage?.max_value !== 100
		) {
			errors.push('/rpg heal resource choices or percentage bounds are incorrect.');
		}
		for (const [subcommand, optionName] of [
			['damage', 'character-key'],
			['damage', 'damage-amount'],
			['delete', 'character-key'],
			['end-turn', 'character-key'],
			['gen', 'category'],
			['gen-char', 'level'],
			['gen-char', 'background'],
			['get', 'character-key'],
			['get', 'field'],
			['heal', 'character-key'],
			['heal', 'percentage'],
			['roll', 'sides'],
			['set', 'character-key'],
			['set', 'field'],
		]) {
			if (!hasAutocomplete(subcommand, optionName)) {
				errors.push(`Missing autocomplete for /rpg ${subcommand} ${optionName}.`);
			}
		}

		for (const commandName of ['purge']) {
			const option = commands.get(commandName).data.toJSON().options[0];
			if (!option.autocomplete) {
				errors.push(`Missing autocomplete for /${commandName}.`);
			}
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

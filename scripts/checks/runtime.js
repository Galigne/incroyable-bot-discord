module.exports = function createRuntimeChecks(context) {
	const {
		errors,
		ffmpegPath,
		fs,
		path,
		root,
		spawnSync,
		config,
		validateConfig,
	} = context;

	function checkNodeVersion() {
		const [major, minor] = process.versions.node.split('.').map(Number);
		if (major < 22 || (major === 22 && minor < 12)) {
			errors.push(`Node.js ${process.versions.node} is too old. Version 22.12.0 or newer is required.`);
		}
	}

	function checkJavaScriptSyntax() {
		for (const file of findJavaScriptFiles(root)) {
			const result = spawnSync(process.execPath, ['--check', file], {
				encoding: 'utf8',
			});
			if (result.status !== 0) {
				errors.push(`${path.relative(root, file)}: ${result.stderr.trim()}`);
			}
		}
	}

	function checkDeprecatedInteractionOptions() {
		for (const file of findJavaScriptFiles(root)) {
			const source = fs.readFileSync(file, 'utf8');
			if (/\bephemeral\s*:/.test(source)) {
				errors.push(
					`${path.relative(root, file)} uses the deprecated ephemeral response option.`,
				);
			}
		}
	}

	function checkArchitectureBoundaries() {
		const domainRoots = [
			path.join(root, 'models'),
			path.join(root, 'services'),
		];
		for (const directory of domainRoots) {
			for (const file of findJavaScriptFiles(directory)) {
				const source = fs.readFileSync(file, 'utf8');
				const relativePath = path.relative(root, file);
				if (/require\(['"](?:discord\.js|@discordjs\/)/.test(source)) {
					errors.push(`${relativePath} imports a Discord integration from the domain layer.`);
				}
				if (/require\(['"][^'"]*util\/i18n['"]\)/.test(source)) {
					errors.push(`${relativePath} imports the localization catalog from the domain layer.`);
				}
			}
		}

		for (const file of findJavaScriptFiles(path.join(root, 'commands'))) {
			const source = fs.readFileSync(file, 'utf8');
			const relativePath = path.relative(root, file);
			if (/\bnew\s+EmbedBuilder\b/.test(source)) {
				errors.push(`${relativePath} constructs embeds instead of using a response adapter.`);
			}
			if (/services\/(?:characterStore|mechanics\/)/.test(source)) {
				errors.push(`${relativePath} bypasses the character application service.`);
			}
		}

		const characterModel = fs.readFileSync(
			path.join(root, 'models', 'Character.js'),
			'utf8',
		);
		if (/\bto(?:Field)?Embed\s*\(/.test(characterModel)) {
			errors.push('models/Character.js must not own Discord embed rendering.');
		}

		const { COMMAND_METADATA } = require('../../commands/metadata');
		for (const metadata of COMMAND_METADATA.filter(command => command.handler)) {
			if (!metadata.handler.startsWith('./handlers/')) {
				errors.push(
					`${metadata.id} must keep its top-level adapter in commands/handlers/.`,
				);
			}
			const handlerPath = path.join(
				root,
				'commands',
				`${metadata.handler.slice('./'.length)}.js`,
			);
			const source = fs.readFileSync(handlerPath, 'utf8');
			if (
				/\bSlashCommandBuilder\b/.test(source)
				|| /\blocalizeDescription\b/.test(source)
				|| /\bconfigure\s*:/.test(source)
				|| /\bhelpOrder\s*:/.test(source)
				|| /\bdescriptionKey\s*:/.test(source)
				|| /\baccess\s*:/.test(source)
			) {
				errors.push(
					`${path.relative(root, handlerPath)} duplicates command registry metadata.`,
				);
			}
		}
		if (fs.existsSync(path.join(root, 'commands', 'rpg'))) {
			errors.push(
				'commands/rpg must not group top-level handlers by help category.',
			);
		}
		const indexSource = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
		const registrationSource = fs.readFileSync(
			path.join(root, 'adapters', 'discordCommandRegistration.js'),
			'utf8',
		);
		if (
			!indexSource.includes('createCommandRegistrationLifecycle(')
			|| !registrationSource.includes('getDiscordCommandData()')
			|| !registrationSource.includes('guild.commands.set(commands)')
			|| !indexSource.includes('Events.GuildCreate')
			|| /application\.commands\.set\(commands\)/.test(registrationSource)
		) {
			errors.push(
				'Guild slash-command registration must use the centralized command registry.',
			);
		}
	}

	function checkConfiguration() {
		if (Object.hasOwn(config, 'token')) {
			errors.push('config.json must not contain a token.');
		}
		if (Object.hasOwn(config, 'prefix')) {
			errors.push('config.json should not contain an obsolete message-command prefix.');
		}
		expectValidConfiguration(config, 'the active configuration');
		expectValidConfiguration(createConfig('en'), 'English locale');
		expectValidConfiguration(createConfig('fr'), 'French locale');
		expectValidConfiguration({
			...createConfig('en'),
			channels: {},
		}, 'an omitted team voice channel');
		expectValidConfiguration({
			...createConfig('fr'),
			channels: undefined,
		}, 'an omitted channels object');
		expectValidConfiguration({
			...createConfig('en'),
			roles: { dm: 'dm-role' },
		}, 'only a DM role');
		expectValidConfiguration({
			...createConfig('en'),
			roles: { moderator: 'moderator-role' },
		}, 'only a moderator role');
		expectValidConfiguration({
			...createConfig('en'),
			roles: {},
		}, 'an empty roles object');
		const withoutRoles = createConfig('en');
		delete withoutRoles.roles;
		expectValidConfiguration(withoutRoles, 'an omitted roles object');

		expectInvalidConfiguration(createConfig('de'), 'an unsupported locale');
		const missingLocale = createConfig('en');
		delete missingLocale.locale;
		expectInvalidConfiguration(missingLocale, 'a missing locale');
		const missingBotUserId = createConfig('en');
		delete missingBotUserId.botUserId;
		expectInvalidConfiguration(missingBotUserId, 'a missing bot user ID');
		const missingDmRole = createConfig('en');
		delete missingDmRole.roles.dm;
		expectValidConfiguration(missingDmRole, 'a missing DM role');
		const missingModeratorRole = createConfig('en');
		delete missingModeratorRole.roles.moderator;
		expectValidConfiguration(missingModeratorRole, 'a missing moderator role');
		for (const roleKey of ['dm', 'moderator']) {
			for (const invalidValue of ['', '   ', null, 42]) {
				const invalidRoleConfig = createConfig('en');
				invalidRoleConfig.roles[roleKey] = invalidValue;
				expectInvalidConfiguration(
					invalidRoleConfig,
					`an invalid configured ${roleKey} role`,
				);
			}
		}
		for (const oldRole of [
			['new', 'Member'].join(''),
			'member',
			'owner',
		]) {
			const obsoleteRoleConfig = createConfig('en');
			obsoleteRoleConfig.roles[oldRole] = 'obsolete-role';
			expectInvalidConfiguration(
				obsoleteRoleConfig,
				`the obsolete roles.${oldRole} field`,
			);
		}

		const guidePath = path.join(root, 'config.json.example');
		if (!fs.existsSync(guidePath)) {
			errors.push('config.json.example is missing.');
		}
		else {
			const guide = JSON.parse(fs.readFileSync(guidePath, 'utf8'));
			if (
				typeof guide.locale !== 'string'
				|| typeof guide.botUserId !== 'string'
				|| typeof guide.roles?.dm !== 'string'
				|| typeof guide.roles?.moderator !== 'string'
			) {
				errors.push('config.json.example should explain every supported configuration field.');
			}
		}

		checkRemovedRoleSystem();
	}

	function createConfig(locale) {
		return {
			botUserId: 'bot',
			locale,
			roles: {
				dm: 'dm-role',
				moderator: 'moderator-role',
			},
		};
	}

	function expectValidConfiguration(candidate, description) {
		try {
			validateConfig(candidate);
		}
		catch (error) {
			errors.push(`Configuration validation rejected ${description}: ${error.message}`);
		}
	}

	function expectInvalidConfiguration(candidate, description) {
		try {
			validateConfig(candidate);
			errors.push(`Configuration validation accepted ${description}.`);
		}
		catch {
			// Expected.
		}
	}

	function checkRemovedRoleSystem() {
		const formerJoinRole = ['new', 'Member'].join('');
		const formerGeneralRole = ['roles', 'member'].join('.');
		const forbiddenConfigurationReferences = [
			formerJoinRole,
			formerGeneralRole,
			['roles', 'owner'].join('.'),
		];
		for (const file of findRepositoryTextFiles(root)) {
			const relativePath = path.relative(root, file);
			const source = fs.readFileSync(file, 'utf8');
			for (const reference of forbiddenConfigurationReferences) {
				if (source.includes(reference)) {
					errors.push(`${relativePath} still references obsolete configuration: ${reference}`);
				}
			}
		}

		const indexSource = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
		const clientSource = fs.readFileSync(path.join(root, 'client', 'Client.js'), 'utf8');
		if (
			indexSource.includes(['Guild', 'MemberAdd'].join(''))
			|| indexSource.includes('roles.add(')
			|| clientSource.includes(['Guild', 'Members'].join(''))
		) {
			errors.push('Automatic role assignment or its guild-member intent still exists.');
		}
	}

	function findRepositoryTextFiles(directory) {
		const files = [];
		for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
			if (['.git', 'node_modules', 'save'].includes(entry.name)) {
				continue;
			}
			const fullPath = path.join(directory, entry.name);
			if (entry.isDirectory()) {
				files.push(...findRepositoryTextFiles(fullPath));
			}
			else if (/\.(?:js|json|md)$/i.test(entry.name)) {
				files.push(fullPath);
			}
		}
		return files;
	}

	function checkRequiredFiles() {
		const localAudioFile = path.join('media', 'Poutouyemoun.mp3');
		for (const file of [
			path.join('documentation', 'TTRPG_RANDOM_RULES_EN.md'),
			path.join('media', 'HEADS.gif'),
			path.join('media', 'LOGO.jpg'),
			localAudioFile,
			path.join('media', 'TAILS.gif'),
			...Array.from(
				{ length: 20 },
				(_, index) => path.join('media', `D20-${index + 1}.gif`),
			),
		]) {
			if (!fs.existsSync(path.join(root, file))) {
				errors.push(`Required file is missing: ${file}`);
			}
		}

		if (fs.existsSync(path.join(root, 'embeds', 'ruleList.json'))) {
			errors.push('The obsolete RPG rules embed still exists.');
		}

		const audioCheck = spawnSync(
			ffmpegPath,
			['-v', 'error', '-i', path.join(root, localAudioFile), '-f', 'null', '-'],
			{ encoding: 'utf8' },
		);
		if (audioCheck.status !== 0) {
			errors.push(`Local MP3 validation failed: ${audioCheck.stderr.trim()}`);
		}
	}

	function findJavaScriptFiles(directory) {
		const files = [];
		for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
			if (['.git', 'node_modules'].includes(entry.name)) {
				continue;
			}
			const fullPath = path.join(directory, entry.name);
			if (entry.isDirectory()) {
				files.push(...findJavaScriptFiles(fullPath));
			}
			else if (entry.name.endsWith('.js')) {
				files.push(fullPath);
			}
		}
		return files;
	}

	return {
		checkNodeVersion,
		checkJavaScriptSyntax,
		checkDeprecatedInteractionOptions,
		checkArchitectureBoundaries,
		checkConfiguration,
		checkRequiredFiles,
	};
};

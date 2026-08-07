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

	function checkArchitectureBoundaries() {
		const { COMMAND_METADATA } = require('../../commands/metadata');
		for (const metadata of COMMAND_METADATA.filter(command => command.handler)) {
			if (!metadata.handler.startsWith('./handlers/')) {
				errors.push(
					`${metadata.id} must keep its top-level adapter in commands/handlers/.`,
				);
			}
		}
		if (fs.existsSync(path.join(root, 'commands', 'rpg'))) {
			errors.push(
				'commands/rpg must not group top-level handlers by help category.',
			);
		}
	}

	function checkConfiguration() {
		if (Object.hasOwn(config, 'token')) {
			errors.push('config.json must not contain the obsolete token field.');
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
		const missingDiscordToken = createConfig('en');
		delete missingDiscordToken.discordToken;
		expectInvalidConfiguration(missingDiscordToken, 'a missing Discord token');
		for (const invalidValue of ['', '   ', null, 42]) {
			expectInvalidConfiguration({
				...createConfig('en'),
				discordToken: invalidValue,
			}, 'an invalid Discord token');
		}
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
		const unsupportedRoleConfig = createConfig('en');
		unsupportedRoleConfig.roles.unsupported = 'role-id';
		expectInvalidConfiguration(
			unsupportedRoleConfig,
			'an unsupported role property',
		);

		const guidePath = path.join(root, 'config.json.example');
		if (!fs.existsSync(guidePath)) {
			errors.push('config.json.example is missing.');
		}
		else {
			const guide = JSON.parse(fs.readFileSync(guidePath, 'utf8'));
			if (
				typeof guide.discordToken !== 'string'
				|| typeof guide.locale !== 'string'
				|| typeof guide.botUserId !== 'string'
				|| typeof guide.roles?.dm !== 'string'
				|| typeof guide.roles?.moderator !== 'string'
			) {
				errors.push('config.json.example should explain every supported configuration field.');
			}
		}

	}

	function createConfig(locale) {
		return {
			botUserId: 'bot',
			discordToken: 'test-token',
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

	return {
		checkNodeVersion,
		checkArchitectureBoundaries,
		checkConfiguration,
		checkRequiredFiles,
	};
};

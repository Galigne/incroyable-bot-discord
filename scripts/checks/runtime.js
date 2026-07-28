module.exports = function createRuntimeChecks(context) {
	const {
		errors,
		ffmpegPath,
		fs,
		path,
		root,
		spawnSync,
		config,
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

	function checkConfiguration() {
		if (Object.hasOwn(config, 'token')) {
			errors.push('config.json must not contain a token.');
		}
		for (const key of ['botUserId', 'roles', 'channels']) {
			if (!config[key]) {
				errors.push(`config.json is missing ${key}.`);
			}
		}
		if (Object.hasOwn(config, 'prefix')) {
			errors.push('config.json should not contain an obsolete message-command prefix.');
		}
		for (const role of ['newMember', 'member', 'dm', 'moderator', 'owner']) {
			if (!config.roles?.[role]) {
				errors.push(`config.json is missing the ${role} role.`);
			}
		}
		const configuredLocales = [
			config.locale,
			...Object.values(config.guildLocales ?? {}),
		].filter(Boolean);
		if (configuredLocales.some(locale => !['en', 'fr'].includes(locale))) {
			errors.push('config.json contains an unsupported locale. Use en or fr.');
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
		checkConfiguration,
		checkRequiredFiles,
	};
};

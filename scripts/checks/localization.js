const { createCharacterSummaryEmbed } = require('../../util/characterRenderer');

module.exports = function createLocalizationChecks(context) {
	const {
		errors,
		loadCommands,
		path,
		root,
	} = context;
	const {
		createTranslator,
		findMissingKeys,
		flattenKeys,
		getLocale,
		translations,
	} = require('../../util/i18n');
	const {
		CHARACTER_DISPLAY_FIELDS,
		RESOURCE_IDS,
		getCharacterFieldDefinition,
		getCharacterFieldLabel,
		getResourceAbbreviation,
		getResourceName,
	} = require('../../util/characterDisplay');

	function checkLocalization() {
		const englishKeys = flattenKeys(translations.en).sort();
		const frenchKeys = flattenKeys(translations.fr).sort();
		if (englishKeys.join('\n') !== frenchKeys.join('\n')) {
			const missing = findMissingKeys();
			errors.push(
				`Locale catalogs do not contain exactly the same keys: ${JSON.stringify(missing)}`,
			);
		}

		const missingReports = [];
		const translate = createTranslator({
			en: {
				fallback: 'English fallback',
				greeting: 'Hello, {{name}}!',
			},
			fr: {
				greeting: 'Bonjour, {{name}} !',
			},
		}, (locale, key) => missingReports.push(`${locale}:${key}`));

		if (translate('fr', 'fallback') !== 'English fallback') {
			errors.push('Localization does not fall back to English.');
		}
		if (!missingReports.includes('fr:fallback')) {
			errors.push('Missing localized translation keys are not reported.');
		}
		if (translate('en', 'absent') !== 'absent' || !missingReports.includes('en:absent')) {
			errors.push('Missing English translation keys are not detected.');
		}
		if (translate('fr', 'greeting', { name: 'Diego' }) !== 'Bonjour, Diego !') {
			errors.push('Localization variable interpolation is incorrect.');
		}

		const syntheticMissing = findMissingKeys({
			en: { shared: 'value', onlyEnglish: 'value' },
			fr: { shared: 'valeur' },
		});
		if (syntheticMissing.fr.join(',') !== 'onlyEnglish') {
			errors.push('Locale key parity detection did not identify a missing key.');
		}
		if (
			getLocale({ locale: 'fr' }, 'guild') !== 'fr'
			|| getLocale({ locale: 'unsupported' }, 'guild') !== 'en'
		) {
			errors.push('Configured locale selection or English fallback is incorrect.');
		}

		const commands = loadCommands(path.join(root, 'commands'));
		for (const command of commands.values()) {
			const data = command.data.toJSON();
			if (!data.description_localizations?.fr || data.name_localizations) {
				errors.push(`Invalid slash-command localization metadata: ${command.name}.`);
			}
			checkOptionLocalizations(data.options ?? [], command.name);
		}

		const Character = require('../../models/Character');
		const frenchSummary = createCharacterSummaryEmbed(
			new Character('Localisation', 'tester'),
			'fr',
		).toJSON();
		if (
			!frenchSummary.description.includes('Niveau')
			|| frenchSummary.fields[0]?.name !== 'État'
			|| !frenchSummary.fields[0]?.value.includes('PV:')
			|| !frenchSummary.fields[0]?.value.includes('PR:')
			|| !frenchSummary.fields[0]?.value.includes('PA:')
			|| !frenchSummary.fields[0]?.value.includes('DD:')
			|| frenchSummary.fields[1]?.name !== 'Statistiques'
			|| !frenchSummary.fields[1]?.value.includes('Dons raciaux')
			|| frenchSummary.fields[2]?.name !== 'LOI'
		) {
			errors.push('Character embeds do not use the configured locale.');
		}

		const { createFieldModal } = require('../../commands/rpg/interactions');
		const frenchModal = createFieldModal(
			'test',
			'statistics',
			[
				'constitution: 10',
				'strength: 10',
				'dexterity: 10',
				'intelligence: 10',
				'speed: 10',
				'perception: 10',
				'charisma: 10',
				'initiative: 10',
				'reflexes: 10',
			].join('\n'),
			'fr',
		).toJSON();
		if (frenchModal.title !== 'Modifier Statistiques') {
			errors.push('Character editor modals do not use the configured locale.');
		}
		for (const [fieldId, expected] of Object.entries({
			'racialTraits': 'Dons raciaux',
			'rules': 'LOI',
		})) {
			if (getCharacterFieldLabel('fr', fieldId) !== expected) {
				errors.push(`French rulebook terminology is incorrect for ${fieldId}.`);
			}
		}
		checkCharacterDisplayCatalog(commands);
	}

	function checkCharacterDisplayCatalog(commands) {
		const { BASE_STATS, DERIVED_STATS } = require('../../services/mechanics/constants');
		const expectedFieldIds = [
			'key',
			'name',
			'firstName',
			'lastName',
			'level',
			'level.value',
			'status',
			'statistics',
			'rules',
			'talents',
			'gear',
			'race',
			'background',
			'race.name',
			'race.physicalDescription',
			'race.lore',
			'appearance',
			'backstory',
			'goals',
			'personality',
			'personality.description',
			'personality.traits',
			'racialTraits',
			'racialTraits.skillBonus',
			'racialTraits.physicalAbility',
			'statistics.base',
			'statistics.derived',
			...[...BASE_STATS, ...DERIVED_STATS].map(stat => `stats.${stat}`),
			'rules.value',
			'rules.name',
			'rules.level',
			'rules.description',
			'talents.value',
			'statusEffects',
			'equipment',
			'inventory',
			'encumbrance',
			'encumbrance.current',
			'encumbrance.max',
			...RESOURCE_IDS.flatMap(resource => [
				`resources.${resource}`,
				`resources.${resource}.current`,
				`resources.${resource}.max`,
			]),
		];
		const actualFieldIds = Object.keys(CHARACTER_DISPLAY_FIELDS);
		if (
			expectedFieldIds.some(fieldId => !actualFieldIds.includes(fieldId))
			|| actualFieldIds.some(fieldId => !expectedFieldIds.includes(fieldId))
		) {
			errors.push('The character display catalog does not match the displayable schema.');
		}

		for (const [fieldId, definition] of Object.entries(CHARACTER_DISPLAY_FIELDS)) {
			for (const locale of ['en', 'fr']) {
				const label = getCharacterFieldLabel(locale, fieldId);
				if (!label || label === definition.labelKey || label.includes('{{')) {
					errors.push(`${fieldId} is missing a valid ${locale} display label.`);
				}
			}
		}

		const abbreviationsByLocale = { en: [], fr: [] };
		for (const resourceId of RESOURCE_IDS) {
			const definition = getCharacterFieldDefinition(`resources.${resourceId}`);
			if (!definition?.abbreviationKey) {
				errors.push(`${resourceId} is missing abbreviation metadata.`);
				continue;
			}
			for (const locale of ['en', 'fr']) {
				const name = getResourceName(locale, resourceId);
				const abbreviation = getResourceAbbreviation(locale, resourceId);
				if (!name || name.includes('{{')) {
					errors.push(`${resourceId} is missing a valid ${locale} full name.`);
				}
				if (!/^[A-Z]{2,4}$/.test(abbreviation)) {
					errors.push(`${resourceId} has an invalid ${locale} abbreviation.`);
				}
				abbreviationsByLocale[locale].push(abbreviation);
			}
		}
		for (const [locale, abbreviations] of Object.entries(abbreviationsByLocale)) {
			if (new Set(abbreviations).size !== RESOURCE_IDS.length) {
				errors.push(`${locale} resource abbreviations are not unique.`);
			}
		}

		const {
			getEditableFields,
			getViewableFields,
		} = require('../../services/characterFieldCatalog');
		const fieldIds = [
			...getEditableFields().map(field => field.editId),
			...getViewableFields().map(field => field.viewId),
		];
		for (const fieldId of fieldIds) {
			if (!getCharacterFieldDefinition(fieldId)) {
				errors.push(`Displayable command field is missing from the catalog: ${fieldId}.`);
			}
		}

		const healChoices = commands.get('heal').data.toJSON().options
			.find(option => option.name === 'resource').choices;
		if (
			healChoices.map(choice => choice.value).join(',') !== 'hp,armor,both'
			|| healChoices.map(choice => choice.name).join(',')
				!== 'HP — Hit points,AR — Armor rating,HP and AR'
			|| healChoices.map(choice => choice.name_localizations?.fr).join(',')
				!== 'PV — Points de vie,PR — Points d’armure,PV et PR'
		) {
			errors.push('Localized resource choices do not preserve their English internal values.');
		}
	}

	function checkOptionLocalizations(options, commandName) {
		for (const option of options) {
			if (!option.description_localizations?.fr || option.name_localizations) {
				errors.push(
					`Invalid localized option metadata for /${commandName} ${option.name}.`,
				);
			}
			checkOptionLocalizations(option.options ?? [], commandName);
		}
	}

	return { checkLocalization };
};

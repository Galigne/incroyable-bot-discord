const {
	createCharacterFieldEmbed,
	createCharacterSummaryEmbed,
} = require('../../util/characterRenderer');

module.exports = function createCharacterChecks(context) {
	const {
		BASE_STAT_NAMES,
		Character,
		allocateRuleLevels,
		calculateMaxAp,
		calculateMaxHp,
		calculateMaxMovementDistance,
		calculateRulePoints,
		calculateStatBudget,
		calculateStatCost,
		characterStore,
		dealDamage,
		errors,
		fs,
		generatorCatalog,
		getEditableFieldValue,
		path,
		populateRandomCharacter,
		resetTurnResources,
		restoreResource,
		root,
		setEditableFieldValue,
	} = context;

	function checkCharacterModel() {
		try {
			const original = new Character('Test', '0');
			setEditableFieldValue(original, 'name', 'Diego:Robert');
			setEditableFieldValue(
				original,
				'statistics',
				[
					'constitution: 10',
					'strength: 12',
					'dexterity: 10',
					'intelligence: 10',
					'speed: 10',
					'perception: 10',
					'charisma: 10',
					'initiative: 10',
					'reflexes: 10',
				].join('\n'),
			);
			setEditableFieldValue(original, 'race', {
				'race.name': 'Ashborn',
				'race.physicalDescription': '',
				'race.lore': '',
				'racialTraits.skillBonus': '',
				'racialTraits.physicalAbility': '',
			});
			setEditableFieldValue(original, 'background', {
				appearance: 'Tall with silver hair.',
				backstory: '',
				goals: '',
			});
			setEditableFieldValue(original, 'equipment', '- Longsword');
			setEditableFieldValue(original, 'personality', {
				'personality.description': '',
				'personality.traits': '- Brave\n- Curious',
			});
			setEditableFieldValue(
				original,
				'rules',
				'- Fire: 2: Controls flames\n- Blink: 1: Teleports a short distance',
			);
			setEditableFieldValue(
				original,
				'talents',
				'- Athlete — +1 to sustained movement.\n'
					+ '- Cold Immunity — Ordinary cold cannot freeze the character.',
			);
			try {
				setEditableFieldValue(original, 'rules', 'Fire: 0: Invalid level');
				errors.push('RULE levels below 1 should be rejected.');
			}
			catch (error) {
				if (error.code !== 'INVALID_CHARACTER_EDIT') {
					throw error;
				}
				setEditableFieldValue(
					original,
					'rules',
					'- Fire: 2: Controls flames\n- Blink: 1: Teleports a short distance',
				);
			}
			try {
				setEditableFieldValue(original, 'ap', '4:11');
				errors.push('AP values above 10 should be rejected.');
			}
			catch (error) {
				if (error.code !== 'INVALID_CHARACTER_EDIT') {
					throw error;
				}
			}
			original.resources.hp.current = 1;
			original.resources.ar.current = 30;
			original.resources.hp.current = 100;
			const armoredDamage = dealDamage(original, 40);
			if (
				armoredDamage.arDamage !== 30
				|| armoredDamage.hpDamage !== 10
				|| original.resources.ar.current !== 0
				|| original.resources.hp.current !== 90
			) {
				errors.push('Normal damage does not reduce AR before HP.');
			}
			original.resources.ar.current = 20;
			const piercingDamage = dealDamage(original, 15, true);
			if (
				piercingDamage.arDamage !== 0
				|| piercingDamage.hpDamage !== 15
				|| original.resources.ar.current !== 20
				|| original.resources.hp.current !== 75
			) {
				errors.push('Piercing damage does not bypass AR.');
			}
			try {
				dealDamage(original, 0);
				errors.push('Non-positive damage should be rejected.');
			}
			catch (error) {
				if (error.code !== 'INVALID_CHARACTER_EDIT') {
					throw error;
				}
			}
			original.resources.hp.current = 1;
			original.resources.ar.current = 0;
			original.resources.ap.current = 0;
			original.resources.md.current = 0;
			restoreResource(original, 'hp', 50);
			resetTurnResources(original);
			const character = Character.fromSave(JSON.parse(JSON.stringify(original)));
			if (
				character.creatorId !== '0'
				|| character.key !== 'Test'
				|| character.firstName !== 'Diego'
				|| character.lastName !== 'Robert'
				|| character.displayName !== 'Diego Robert'
				|| character.stats.strength !== 12
				|| character.race.name !== 'Ashborn'
				|| character.appearance !== 'Tall with silver hair.'
				|| getEditableFieldValue(character, 'personality')['personality.traits']
					!== 'Brave\nCurious'
				|| getEditableFieldValue(character, 'rules')
					!== 'Fire: 2: Controls flames\nBlink: 1: Teleports a short distance'
				|| character.rules[0]?.description !== 'Controls flames'
				|| character.rules[0]?.level !== 2
				|| character.rules[1]?.name !== 'Blink'
				|| character.rules[1]?.level !== 1
				|| getEditableFieldValue(character, 'talents')
					!== 'Athlete — +1 to sustained movement.\n'
						+ 'Cold Immunity — Ordinary cold cannot freeze the character.'
				|| character.equipment[0] !== 'Longsword'
				|| character.resources.hp.current !== 50
				|| character.resources.ap.current !== character.resources.ap.max
				|| character.resources.md.current !== character.resources.md.max
			) {
				errors.push('Character saves are not restored correctly.');
			}
			const summary = createCharacterSummaryEmbed(character).toJSON();
			const status = summary.fields.find(field => field.name === 'Status');
			if (
				!summary.description.includes('Tall with silver hair.')
				|| !status
				|| !status.value.includes('HP: **50 / 100 (50%)**')
				|| !status.value.includes(`${'❤️'.repeat(5)}${'🖤'.repeat(5)}`)
				|| !status.value.includes('🟧'.repeat(10))
				|| !status.value.includes('AP:\n🌟🌟🌟🌟')
				|| summary.fields.some(field => field.name === 'Status effects')
				|| summary.fields[1]?.name !== 'Statistics'
				|| summary.fields[2]?.name !== 'RULEs'
				|| summary.fields.some(field => field.name === '\u200B')
				|| !summary.fields[1]?.value.includes('**Racial traits**')
				|| summary.fields[1]?.value.includes('Initiative:')
				|| summary.fields[1]?.value.includes('Reflexes:')
				|| !summary.fields[2]?.value.includes('Fire (Level 2)')
				|| !summary.fields[2]?.value.includes('**Talents**')
				|| !summary.fields[2]?.value.includes('1. Athlete —')
			) {
				errors.push('The character summary status is not formatted correctly.');
			}
			for (const field of [
				'appearance',
				'race',
				'personality',
				'statistics',
				'rules',
				'status',
				'talents',
			]) {
				const fieldEmbed = createCharacterFieldEmbed(character, field)?.toJSON();
				if (field === 'rules' && !fieldEmbed.description.includes('Fire — Level 2')) {
					errors.push('The detailed RULE view does not show RULE levels.');
				}
				if (field === 'talents' && !fieldEmbed.description.includes('2. Cold Immunity —')) {
					errors.push('The detailed talent view does not render talents as a list.');
				}
				if (
					field === 'statistics'
					&& !fieldEmbed.fields?.find(item => item.name === 'Derived statistics')
						?.value.includes('Initiative:')
				) {
					errors.push('The detailed statistics view should retain derived statistics.');
				}
			}
			const legacyCharacter = Character.fromSave({
				key: 'Legacy',
				creatorId: '0',
				rules: [{ name: 'Legacy RULE', description: 'Saved without a level.' }],
				talents: 'Legacy talent\nSecond legacy talent',
			});
			if (
				legacyCharacter.rules[0]?.level !== 1
				|| legacyCharacter.talents.length !== 2
			) {
				errors.push('Legacy RULEs and multiline talents should remain compatible.');
			}
			character.resources.ap.current = 2;
			character.resources.ap.max = 4;
			const apDetail = createCharacterFieldEmbed(character, 'ap').toJSON();
			if (apDetail.description !== 'AP:\n🌟🌟⭐⭐') {
				errors.push('AP availability is not displayed correctly.');
			}
			if (createCharacterFieldEmbed(character, 'unknown') !== null) {
				errors.push('Unknown character detail fields should be rejected.');
			}

		}
		catch (error) {
			errors.push(`Character model: ${error.message}`);
		}
	}

	function checkRandomCharacterGeneration() {
		try {
			let seed = 12_345;
			const random = () => {
				seed = (seed * 1_664_525 + 1_013_904_223) % 4_294_967_296;
				return seed / 4_294_967_296;
			};
			const character = new Character('D.Robert', 'dm');
			populateRandomCharacter(character, { level: 10, random });
			const generatedRace = generatorCatalog.getCategory('race').entries
				.find(entry => entry.fields.Name === character.race.name);

			if (
				character.key !== 'D.Robert'
				|| character.level !== 10
				|| !character.firstName
				|| !character.lastName
				|| character.displayName !== `${character.firstName} ${character.lastName}`
				|| !character.race.name
				|| !character.race.physicalDescription
				|| character.race.lore
				|| !character.appearance
				|| !character.backstory
				|| !character.goals
				|| character.personality.traits.length !== 2
				|| character.personality.description
				|| character.racialTraits.skillBonus !== generatedRace?.fields['Skill Bonus']
				|| character.racialTraits.physicalAbility
					!== generatedRace?.fields['Physical Ability']
			) {
				errors.push('Generated identity or intentionally empty fields are incorrect.');
			}

			if (
				calculateStatCost(character.stats) !== calculateStatBudget(character.level)
				|| BASE_STAT_NAMES.some(stat => (
					character.stats[stat] < 4 || character.stats[stat] > 20
				))
				|| character.stats.initiative !== character.stats.speed
				|| character.stats.reflexes !== character.stats.speed
			) {
				errors.push('Generated statistics do not follow the point-allocation rules.');
			}

			const expectedRulePoints = calculateRulePoints(character.stats.intelligence);
			const expectedRuleLevels = allocateRuleLevels(expectedRulePoints);
			const expectedTalentCount = 4;
			if (
				character.rules.length !== expectedRuleLevels.length
				|| character.rules.some((rule, index) => rule.level !== expectedRuleLevels[index])
				|| new Set(character.rules.map(rule => rule.name)).size !== character.rules.length
				|| character.talents.length !== expectedTalentCount
				|| new Set(character.talents).size !== character.talents.length
			) {
				errors.push('Generated RULEs or talents do not match the character attributes.');
			}
			const expectedAllocations = [
				[],
				[1],
				[1, 1],
				[2],
				[2, 1],
				[2, 1],
				[3],
			];
			if (expectedAllocations.some((levels, points) => (
				JSON.stringify(allocateRuleLevels(points)) !== JSON.stringify(levels)
			))) {
				errors.push('RULE Point allocation does not prioritize RULE levels correctly.');
			}

			const expectedHp = calculateMaxHp(character.stats.constitution, character.level);
			if (
				character.resources.hp.max !== expectedHp
				|| character.resources.hp.current !== expectedHp
				|| character.resources.ap.max !== calculateMaxAp(character.level)
				|| character.resources.ap.current !== character.resources.ap.max
				|| character.resources.md.max !== calculateMaxMovementDistance(character.stats.speed)
				|| character.resources.md.current !== character.resources.md.max
			) {
				errors.push('Generated HP, AP, or MD values are incorrect.');
			}

			const armorName = character.equipment[0].split(' — ')[0];
			const armor = generatorCatalog.getCategory('armors').entries
				.find(entry => entry.fields.Name === armorName);
			const armorPercentage = Number(armor?.fields['AR percentage']);
			if (
				!armor
				|| Number(armor.fields['Constitution requirement']) > character.stats.constitution
				|| character.resources.ar.max !== Math.round(expectedHp * armorPercentage / 100)
				|| character.resources.ar.current !== character.resources.ar.max
				|| character.equipment.length < 2
				|| character.equipment.length > 3
				|| character.inventory.length !== 4
				|| !character.inventory.at(-1).endsWith(' gold')
				|| character.encumbrance.max !== character.stats.constitution
			) {
				errors.push('Generated armor, equipment, inventory, AR, or encumbrance is incorrect.');
			}
			createCharacterSummaryEmbed(character).toJSON();

			const routedBackgrounds = generatorCatalog.getCategory('background').entries;
			for (const routedBackground of routedBackgrounds) {
				const backgroundName = routedBackground.fields.Name;
				const routedCharacter = new Character(`background.${backgroundName}`, 'dm');
				populateRandomCharacter(routedCharacter, {
					level: 1,
					background: backgroundName,
					random: () => 0,
				});
				if (
					!routedCharacter.appearance
					|| !routedCharacter.backstory
					|| !routedCharacter.goals
				) {
					errors.push(`Random generation failed for background: ${backgroundName}.`);
				}
			}
		}
		catch (error) {
			errors.push(`Random character generation: ${error.message}`);
		}
	}

	async function checkCharacterStore() {
		const suffix = `${process.pid}_${Date.now()}`;
		const originalName = `check.${suffix}`;
		const savePath = path.join(root, 'save', `${originalName}.json`);

		try {
			await characterStore.createCharacter(originalName, 'creator');
			try {
				await characterStore.createCharacter(originalName, 'creator');
				errors.push('A duplicate character key was allowed.');
			}
			catch (error) {
				if (error.code !== 'EEXIST') {
					throw error;
				}
			}
			try {
				await characterStore.updateCharacter(
					originalName,
					() => false,
					() => undefined,
				);
				errors.push('A non-owner was allowed to edit a character.');
			}
			catch (error) {
				if (error.code !== 'NOT_CHARACTER_EDITOR') {
					throw error;
				}
			}

			await characterStore.updateCharacter(originalName, () => true, character => {
				character.firstName = 'A Display';
				character.lastName = 'Name With Spaces';
				character.resources.hp.current = 42;
			});
			const editedCharacter = await characterStore.getCharacter(originalName);
			if (
				editedCharacter.firstName !== 'A Display'
				|| editedCharacter.lastName !== 'Name With Spaces'
				|| editedCharacter.displayName !== 'A Display Name With Spaces'
				|| editedCharacter.key !== originalName
				|| editedCharacter.resources.hp.current !== 42
			) {
				errors.push('Character edits are not persisted correctly.');
			}
			await characterStore.deleteCharacter(originalName, () => true);
		}
		catch (error) {
			errors.push(`Character store: ${error.message}`);
		}
		finally {
			try {
				fs.unlinkSync(savePath);
			}
			catch (error) {
				if (error.code !== 'ENOENT') {
					errors.push(`Could not clean up character check: ${error.message}`);
				}
			}
		}
	}

	return {
		checkCharacterModel,
		checkRandomCharacterGeneration,
		checkCharacterStore,
	};
};

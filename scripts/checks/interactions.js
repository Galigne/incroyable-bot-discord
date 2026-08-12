module.exports = function createInteractionChecks(context) {
	const {
		characterStore,
		config,
		errors,
	} = context;

	async function checkEntityInteractions() {
		const suffix = `${process.pid}_${Date.now()}`;
		const characterKey = `ux.${suffix}`;
		const { handleEntityInteraction, openEntityEditor } = require(
			'../../commands/entity/interactions',
		);
		const user = { id: 'ux-creator' };
		const member = {
			roles: {
				cache: {
					some: () => false,
				},
			},
		};
		const englishConfig = { ...config, locale: 'en' };

		try {
			await characterStore.createCharacter(characterKey, user.id, character => {
				character.name.firstName = 'Modal';
				character.name.lastName = 'Tester';
			});

			let modalPayload;
			await openEntityEditor({
				user,
				member,
				showModal: async modal => {
					modalPayload = modal.toJSON();
				},
			}, englishConfig, characterKey, 'statistics');
			if (
				modalPayload.title !== 'Edit Statistics'
				|| modalPayload.components.length !== 1
				|| modalPayload.components[0].component.value
					!== [
						'constitution: 10',
						'strength: 10',
						'dexterity: 10',
						'intelligence: 10',
						'speed: 10',
						'perception: 10',
						'charisma: 10',
						'initiative: 10',
						'reflexes: 10',
					].join('\n')
			) {
				errors.push('The direct RPG editor did not prefill a valid statistics modal.');
			}

			let submitPayload;
			await handleEntityInteraction({
				customId: modalPayload.custom_id,
				user,
				member,
				isModalSubmit: () => true,
				fields: {
					getTextInputValue: () => [
						'constitution: 10',
						'strength: 14',
						'dexterity: 10',
						'intelligence: 10',
						'speed: 10',
						'perception: 10',
						'charisma: 10',
						'initiative: 10',
						'reflexes: 10',
					].join('\n'),
				},
				reply: async payload => {
					submitPayload = payload;
				},
			}, englishConfig);
			const editedCharacter = await characterStore.getCharacter(characterKey);
			if (!submitPayload || editedCharacter.statistics.strength !== 14) {
				errors.push('The direct RPG editor did not save its modal value.');
			}

			await characterStore.updateCharacter(characterKey, () => true, character => {
				character.resources.hp = { current: 10, max: 101 };
				character.resources.ar = { current: 5, max: 33 };
			});
			const heal = require('../../commands/handlers/heal');
			let healPayload;
			await heal.execute({
				config: englishConfig,
				interaction: {
					user,
					member,
					options: {
						getString: option => (
							option === 'entity-key' ? characterKey : 'both'
						),
						getNumber: () => 50,
					},
					reply: async payload => {
						healPayload = payload;
					},
				},
			});
			const healedCharacter = await characterStore.getCharacter(characterKey);
			if (
				healedCharacter.resources.hp.current !== 51
				|| healedCharacter.resources.ar.current !== 17
				|| !healPayload.includes('HP: **51 / 101 (50%)**')
				|| !healPayload.includes('AR: **17 / 33 (52%)**')
			) {
				errors.push('/heal both did not update and display both resources.');
			}

		}
		catch (error) {
			errors.push(`Interactive RPG UX: ${error.message}`);
		}
		finally {
			try {
				await characterStore.deleteCharacter(characterKey, () => true);
			}
			catch (error) {
				if (error.code !== 'ENOENT') {
					errors.push(`Could not clean up interactive UX check: ${error.message}`);
				}
			}
		}
	}

	return {
		checkEntityInteractions,
	};
};

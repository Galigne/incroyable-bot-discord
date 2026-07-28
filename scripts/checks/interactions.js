module.exports = function createInteractionChecks(context) {
	const {
		characterStore,
		config,
		errors,
	} = context;

	async function checkInteractiveRpgUx() {
		const suffix = `${process.pid}_${Date.now()}`;
		const characterKey = `ux.${suffix}`;
		const { handleRpgInteraction, openCharacterEditor } = require(
			'../../commands/rpg/interactions'
		);
		const user = { id: 'ux-creator' };
		const member = {
			roles: {
				cache: {
					some: () => false,
				},
			},
		};

		try {
			await characterStore.createCharacter(characterKey, user.id, character => {
				character.firstName = 'Modal';
				character.lastName = 'Tester';
			});

			let modalPayload;
			await openCharacterEditor({
				user,
				member,
				showModal: async modal => {
					modalPayload = modal.toJSON();
				},
			}, config, characterKey, 'stats.strength');
			if (
				modalPayload.title !== 'Edit Strength'
				|| modalPayload.components.length !== 1
				|| modalPayload.components[0].component.value !== '10'
			) {
				errors.push('The direct RPG editor did not prefill a valid statistics modal.');
			}

			let submitPayload;
			await handleRpgInteraction({
				customId: modalPayload.custom_id,
				user,
				member,
				isModalSubmit: () => true,
				fields: {
					getTextInputValue: () => '14',
				},
				reply: async payload => {
					submitPayload = payload;
				},
			}, config);
			const editedCharacter = await characterStore.getCharacter(characterKey);
			if (!submitPayload || editedCharacter.stats.strength !== 14) {
				errors.push('The direct RPG editor did not save its modal value.');
			}

		}
		catch (error) {
			errors.push(`Interactive RPG UX: ${error.message}`);
		}
		finally {
			try {
				await characterStore.deleteCharacter(characterKey, user.id);
			}
			catch (error) {
				if (error.code !== 'ENOENT') {
					errors.push(`Could not clean up interactive UX check: ${error.message}`);
				}
			}
		}
	}

	return {
		checkInteractiveRpgUx,
	};
};

const { MessageFlags } = require('discord.js');
const { getLocale, t } = require('../util/i18n');

function createInteractionHandler({
	authorizeCommand,
	client,
	getConfig,
	handleEntityInteraction,
	logger = console,
	runtimeReloader,
}) {
	return async interaction => {
		let config = {};
		try {
			config = getConfig();
			if (!interaction.inGuild()) {
				await respondOutsideGuild(interaction, config);
				return;
			}

			if (interaction.isModalSubmit()) {
				await handleEntityInteraction(interaction, config);
				return;
			}

			const command = client.commands.get(interaction.commandName);
			if (interaction.isAutocomplete()) {
				if (!command) {
					await interaction.respond([]);
					return;
				}
				const authorization = authorizeCommand(command, interaction, config);
				if (!authorization.allowed || !command.autocomplete) {
					await interaction.respond([]);
					return;
				}
				await command.autocomplete({ client, config, interaction });
				return;
			}

			if (!interaction.isChatInputCommand()) {
				return;
			}
			if (!command) {
				await interaction.reply({
					content: t(getLocale(config), 'common.commandUnavailable'),
					flags: MessageFlags.Ephemeral,
				});
				return;
			}

			const authorization = authorizeCommand(command, interaction, config);
			if (!authorization.allowed) {
				if (authorization.message) {
					await interaction.reply({
						content: authorization.message,
						flags: MessageFlags.Ephemeral,
					});
				}
				return;
			}

			await command.execute({
				client,
				config,
				interaction,
				runtimeReloader,
			});
		}
		catch (error) {
			logger.error(describeInteractionError(interaction), error);
			if (interaction.isAutocomplete()) {
				await interaction.respond([]).catch(ignoreRejection);
				return;
			}
			await replyWithUnexpectedError(interaction, config);
		}
	};
}

async function respondOutsideGuild(interaction, config) {
	if (interaction.isAutocomplete()) {
		await interaction.respond([]);
	}
	else if (interaction.isRepliable()) {
		await interaction.reply({
			content: t(getLocale(config), 'authorization.guildOnly'),
			flags: MessageFlags.Ephemeral,
		});
	}
}

async function replyWithUnexpectedError(interaction, config) {
	if (!interaction.isRepliable()) {
		return;
	}
	const response = {
		content: t(getLocale(config), 'common.unexpectedError'),
		flags: MessageFlags.Ephemeral,
	};
	if (interaction.replied || interaction.deferred) {
		await interaction.followUp(response).catch(ignoreRejection);
	}
	else {
		await interaction.reply(response).catch(ignoreRejection);
	}
}

function describeInteractionError(interaction) {
	if (interaction.isModalSubmit()) {
		return `Error while handling component ${interaction.customId}:`;
	}
	if (interaction.isAutocomplete()) {
		return `Autocomplete failed for /${interaction.commandName}:`;
	}
	return `Error while handling interaction ${interaction.commandName ?? 'unknown'}:`;
}

function ignoreRejection() {
	// The original Discord request may already be closed; the failure is non-actionable.
}

module.exports = { createInteractionHandler, replyWithUnexpectedError };

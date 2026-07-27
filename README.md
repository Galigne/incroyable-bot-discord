# Incredible Discord Bot

A Discord bot with moderation, utility, local audio, and RPG character-management commands.

## Requirements

- Node.js 22.12 or newer
- A Discord application with the Server Members and Message Content intents enabled

## Installation

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env`.
3. Generate a bot token in the Discord Developer Portal.
4. Set `DISCORD_TOKEN` in `.env`.
5. Start the bot with `node index.js`.

Never commit `.env` or a Discord token. Reset any token that has previously been committed.

## Commands

- `!help`
- `!roll <2-1000>`
- `!say <message>`
- `!purge <2-100>`
- `!restart`
- `!rpg help`
- `!rpg rules`
- `!rpg generate list` — list generator categories (DM only)
- `!rpg generate <category>` — generate a random prompt (DM only)

The full TTRPG rules are available in
[`documentation/TTRPG_RANDOM_RULES_EN.md`](documentation/TTRPG_RANDOM_RULES_EN.md).

## Project structure

- `commands/`: top-level Discord commands
- `commands/rpg/subcommands/`: one module per RPG subcommand
- `data/generators/`: editable JSON prompt catalogs for the RPG generators
- `models/`: domain models
- `services/`: character persistence and local MP3 playback
- `util/`: command loading and authorization
- `scripts/check.js`: offline validation

Run `npm test` to validate syntax, command loading, configuration, character-save compatibility, and voice dependencies.

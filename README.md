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
- `!rpg add <character>` — create a character sheet
- `!rpg view <character>` — display its gameplay summary
- `!rpg view <character> <field>` — display a complete field and its sub-fields
- `!rpg viewHelp` — list viewable fields with examples
- `!rpg edit <character> <field> <value>` — edit a scalar field
- `!rpg edit <character> <list> <add|set|remove|clear> ...` — edit a list
- `!rpg editHelp` — explain nested fields, list actions, and RULE syntax
- `!rpg rest <character> <HP|AR> <percentage>` — restore a resource
- `!rpg endTurn <character>` — restore AP and MD to their maximum values

Character creators can edit and manage their own sheets. Members with the configured
DM role, as well as owners, can manage every character sheet.
The identifier supplied to `!rpg add` remains the stable command/save key; editing
the sheet's `name` field only changes its displayed name and may include spaces.

Examples:

```text
!rpg edit Aria race.name Elf
!rpg edit Aria stats.strength 14
!rpg edit Aria personality.traits add Brave
!rpg edit Aria rules add Fire | Controls nearby flames
!rpg edit Aria equipment set 1 Runed longsword
!rpg view Aria personality
!rpg view Aria race
!rpg view Aria rules
!rpg rest Aria HP 50%
!rpg endTurn Aria
```

AP follows `0 ≤ current ≤ max ≤ 10` and uses 🌟 for available points and ⭐ for
spent points. HP, AR, and MD use ten-icon percentage bars.

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

Generator entries may be plain strings, weighted strings, or objects with
multiple display fields. See
[`data/generators/README.md`](data/generators/README.md) for the complete format.

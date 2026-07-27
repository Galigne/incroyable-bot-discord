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
- `!rpg generateList` — list generator categories (DM only)
- `!rpg generate <category>` — generate a random prompt (DM only)
- `!rpg generateCharacter <characterKey> [level]` — generate and save a complete character (DM only)
- `!rpg add <characterKey>` — create a blank character sheet with a stable key
- `!rpg view <characterKey>` — display its gameplay summary
- `!rpg view <characterKey> <field>` — display a complete field and its sub-fields
- `!rpg viewHelp` — list viewable fields with examples
- `!rpg edit <characterKey> <field> <value>` — edit a scalar field
- `!rpg edit <characterKey> <list> <add|set|remove|clear> ...` — edit a list
- `!rpg editHelp` — explain nested fields, list actions, and RULE syntax
- `!rpg rest <characterKey> <HP|AR> <percentage>` — restore a resource
- `!rpg endTurn <characterKey>` — restore AP and MD to their maximum values

Character creators can edit and manage their own sheets. Members with the configured
DM role, as well as owners, can manage every character sheet.
The identifier supplied to `!rpg add` remains the stable command/save key and cannot
be edited. The sheet stores `firstName` and `lastName` separately for display.
Keys may contain internal periods, hyphens, and underscores, such as `D.Robert`.

Examples:

```text
!rpg generateCharacter D.Robert 5
!rpg edit D.Robert firstName Diego
!rpg edit D.Robert lastName Robert
!rpg edit D.Robert race.name Elf
!rpg edit D.Robert stats.strength 14
!rpg edit D.Robert personality.traits add Brave
!rpg edit D.Robert rules add Fire | Controls nearby flames
!rpg edit D.Robert equipment set 1 Runed longsword
!rpg view D.Robert personality
!rpg view D.Robert race
!rpg view D.Robert rules
!rpg rest D.Robert HP 50%
!rpg endTurn D.Robert
```

Random characters use the rulebook's stat budget and nonlinear stat costs. Their
RULE count comes from Intelligence thresholds; HP, AP, MD, armor eligibility, AR,
talent count, equipment, inventory, gold, and encumbrance are derived automatically.
If the optional level is omitted, a level from 1 to 10 is rolled.

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

Run `npm test` to validate syntax, commands, configuration, the current character-save schema, and voice dependencies.

Generator entries may be plain strings, weighted strings, or objects with
multiple display fields. See
[`data/generators/README.md`](data/generators/README.md) for the complete format.

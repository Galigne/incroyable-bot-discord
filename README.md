# Incredible Discord Bot

A Discord bot with moderation, utility, local audio, and RPG character-management commands.

## Requirements

- Node.js 22.12 or newer
- A Discord application with the Server Members intent enabled
- The bot installed with the `bot` and `applications.commands` scopes

## Installation

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env`.
3. Generate a bot token in the Discord Developer Portal.
4. Set `DISCORD_TOKEN` in `.env`.
5. Start the bot with `node index.js`.

The bot registers its global slash commands when it connects. Discord may briefly
need to refresh its command picker after a command schema changes.

Never commit `.env` or a Discord token. Reset any token that has previously been committed.

## Commands

- `/help`
- `/roll sides:<2-1000>`
- `/say message:<text>`
- `/purge amount:<2-100>`
- `/restart`
- `/rpg help`
- `/rpg rules`
- `/rpg generate category:<category>` — generate a random prompt (DM only)
- `/rpg generate-character character-key:<new key> [level]` — generate and save a complete character (DM only)
- `/rpg generate-help` — explain generation and list generator categories (DM only)
- `/rpg add character-key:<new key>` — create a blank character sheet with a stable key
- `/rpg view character-key:<key> [field]` — display the summary or one complete field
- `/rpg view-help` — list viewable fields and examples
- `/rpg edit character-key:<key> field:<field>` — edit one field in a prefilled form
- `/rpg edit-help` — list editable fields and explain multiline form values
- `/rpg rest character-key:<key> resource:<HP|AR> percentage:<0-100>` — restore a resource
- `/rpg end-turn character-key:<key>` — restore AP and MD to their maximum values

Discord provides native validation and choices for constrained options.
Autocomplete suggests existing CharacterKeys, editable fields, viewable fields,
generator categories, common dice sizes, levels, and common purge amounts. The
private edit form opens immediately after `/rpg edit` is submitted. Multiline
fields accept free-form lines with optional leading dashes; RULEs use
`Name: Description`.

Character creators can edit and manage their own sheets. Members with the configured
DM role, as well as owners, can manage every character sheet.
The identifier supplied to `/rpg add` remains the stable command/save key and cannot
be edited. The sheet stores `firstName` and `lastName` separately for display.
Keys may contain internal periods, hyphens, and underscores, such as `D.Robert`.

Example workflows:

```text
/rpg generate-character character-key:D.Robert level:5
/rpg edit character-key:D.Robert field:stats.strength
/rpg edit character-key:D.Robert field:rules
/rpg view character-key:D.Robert
/rpg view character-key:D.Robert field:personality
/rpg rest character-key:D.Robert resource:HP percentage:50
/rpg end-turn character-key:D.Robert
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

- `commands/`: top-level slash commands
- `commands/rpg/subcommands/`: one module per RPG subcommand
- `data/generators/`: editable JSON prompt catalogs for the RPG generators
- `models/`: domain models
- `services/`: character persistence and local MP3 playback
- `util/`: command loading and authorization
- `scripts/check.js`: offline validation

Run `npm test` to validate syntax, slash-command schemas, autocomplete configuration,
permissions, the current character-save schema, and voice dependencies.

Generator entries may be plain strings, weighted strings, or objects with
multiple display fields. See
[`data/generators/README.md`](data/generators/README.md) for the complete format.

# Incredible Discord Bot

A Discord bot with moderation, utility, local audio, and RPG character-management commands.

## Requirements

- Node.js 22.12 or newer
- The bot installed with the `bot` and `applications.commands` scopes

## Installation

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env`.
3. Generate a bot token in the Discord Developer Portal.
4. Set `DISCORD_TOKEN` in `.env`.
5. Copy [`config.json.example`](config.json.example) to `config.json` and replace
   each explanation with the corresponding Discord value.
6. Start the bot with `node index.js`.

The bot registers its global slash commands when it connects. Discord may briefly
need to refresh its command picker after a command schema changes.

## Localization

All bot-owned user-facing text is centralized in `locales/en.json` and
`locales/fr.json`. Slash command and option names remain English, while Discord
receives localized French descriptions and choice labels.
French game terminology follows `documentation/JDR_RANDOM_RULES_FR.md`; for example,
the localized interface uses PV, PR, PA, DD, LOI, and dons raciaux.
Character field names and resource abbreviations are mapped centrally in
`util/characterDisplay.js`. Resource abbreviations are unique within each language:
HP/AR/AP/MD in English and PV/PR/PA/DD in French.

Generator catalogs follow the same server locale. English reference files live in
`data/generators/en/` and French display content in `data/generators/fr/`.
Autocomplete labels and generated text are localized, while generator IDs,
structured field keys, enum values, and routing values remain English. Content
already saved in a character sheet is never translated retroactively.

Set the required runtime language in `config.json`. The complete configuration is:

```json
{
  "locale": "fr",
  "botUserId": "YOUR_BOT_USER_ID",
  "roles": {
    "dm": "YOUR_DM_ROLE_ID",
    "moderator": "YOUR_MODERATOR_ROLE_ID"
  },
  "channels": {
    "teamVoice": "OPTIONAL_TEAM_VOICE_CHANNEL_ID"
  }
}
```

`locale`, `botUserId`, `roles.dm`, and `roles.moderator` are required. The only
supported locale values are `en` and `fr`; invalid or missing values stop startup
with a clear error. `channels.teamVoice` and the `channels` object are optional.
The guide file explains what belongs in each field and is never loaded by the bot.
Do not configure an owner user or owner role: the bot reads the actual server owner
from Discord.

Never commit `.env` or a Discord token. Reset any token that has previously been committed.

## Commands

- `/help`
- `/say message:<text>`
- `/purge amount:<2-100>`
- `/restart`
- `/rpg help`
- `/rpg rules`
- `/rpg gen category:<category>` — generate a random prompt (DM only)
- `/rpg gen-char character-key:<new key> [level] [background]` — generate and save a complete character (DM only)
- `/rpg gen-help` — explain generation and list generator categories
- `/rpg roll sides:<2-1000>` — roll a die
- `/rpg add character-key:<new key>` — create a blank character sheet with a stable key
- `/rpg get character-key:<key> [field]` — display the summary or one complete field
- `/rpg get-help` — list retrievable fields and examples
- `/rpg set character-key:<key> field:<field>` — set one field in a prefilled form
- `/rpg set-help` — list settable fields and explain multiline form values
- `/rpg heal character-key:<key> resource:<hp|armor|both> percentage:<0-100>` — restore one or both resources
- `/rpg damage character-key:<key> damage-amount:<number> [piercing]` — apply damage to AR, then HP
- `/rpg end-turn character-key:<key>` — restore AP and MD to their maximum values

Discord provides native validation and choices for constrained options.
Autocomplete suggests existing CharacterKeys, settable fields, retrievable fields,
generator categories, common dice sizes, levels, and common purge amounts. The
private form opens immediately after `/rpg set` is submitted. Multiline
fields accept free-form lines with optional leading dashes; RULEs use
`Name: Level: Description`.

Character creators can edit, delete, heal, damage, and end turns for their own
sheets. Users with the configured DM role can perform those actions on every
character and may use `/rpg gen` and `/rpg gen-char`. Users with the configured
moderator role may use `/say`, `/purge`, and `/restart`. The actual Discord server
owner, identified by Discord rather than configuration, may use every command and
manage every character.
The identifier supplied to `/rpg add` remains the stable command/save key and cannot
be edited. The sheet stores `firstName` and `lastName` separately for display.
Keys may contain internal periods, hyphens, and underscores, such as `D.Robert`.

Example workflows:

```text
/rpg gen-char character-key:D.Robert level:5 background:adventurer
/rpg set character-key:D.Robert field:stats.strength
/rpg set character-key:D.Robert field:rules
/rpg get character-key:D.Robert
/rpg get character-key:D.Robert field:personality
/rpg damage character-key:D.Robert damage-amount:25 piercing:false
/rpg heal character-key:D.Robert resource:both percentage:50
/rpg end-turn character-key:D.Robert
```

Random characters use the rulebook's stat budget and nonlinear stat costs. Their
RULE Points come from Intelligence thresholds and are spent on at most two RULEs,
prioritizing the first RULE's level; HP, AP, MD, armor eligibility, AR,
talent count, equipment, inventory, gold, and encumbrance are derived automatically.
If the optional level is omitted, a level from 1 to 10 is rolled. The optional
background selects one of the configured NPC categories and is also chosen randomly
when omitted. It generates the character's appearance, backstory, and goals.

AP follows `0 ≤ current ≤ max ≤ 10` and uses 🌟 for available points and ⭐ for
spent points. HP, AR, and MD use ten-icon percentage bars.

The full TTRPG rules are available in
[`documentation/TTRPG_RANDOM_RULES_EN.md`](documentation/TTRPG_RANDOM_RULES_EN.md).

## Project structure

- `commands/`: top-level slash commands
- `commands/rpg/subcommands/`: one module per RPG subcommand
- `data/generators/en/` and `data/generators/fr/`: localized JSON prompt catalogs
- `models/`: domain models
- `services/`: character persistence and local MP3 playback
- `util/`: command loading and authorization
- `locales/`: English and French user-interface catalogs
- `scripts/check.js`: offline validation

Run `npm test` to validate syntax, slash-command schemas, autocomplete configuration,
permissions, the current character-save schema, and voice dependencies.

Generator entries may be plain strings, weighted strings, or objects with
multiple display fields. See
[`data/generators/README.md`](data/generators/README.md) for the complete format.
